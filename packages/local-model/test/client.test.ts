import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLocalModelClient, LocalModelError, OLLAMA_ENDPOINT } from '../index.ts';
import type {
  ChatSettings,
  FetchImplementation,
  LocalModelClientOptions,
  LocalModelErrorCode,
} from '../index.ts';

const MODEL = 'qwen3:4b';
const DIGEST = 'a'.repeat(64);
const messages = [{ role: 'user' as const, content: '今天有点累。' }];
const tag = (name = MODEL, modelDigest = DIGEST) => ({
  name,
  model: name,
  digest: modelDigest,
  size: 2600000000,
});
const show = () => ({
  details: { format: 'gguf', parameter_size: '4B', quantization_level: 'Q4_K_M' },
  model_info: {
    'general.architecture': 'qwen3',
    'general.file_type': 15,
    'qwen3.context_length': 32768,
  },
  capabilities: ['completion'],
});
const reply = () => ({
  model: MODEL,
  message: { role: 'assistant', content: '那先歇一会儿，我陪你。' },
  done: true,
  done_reason: 'stop',
  total_duration: 2000000000,
  load_duration: 100000000,
  prompt_eval_duration: 500000000,
  eval_duration: 1000000000,
  prompt_eval_count: 24,
  eval_count: 10,
});
const json = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
type Call = { url: string; init: RequestInit; body: Record<string, unknown> | undefined };
type Handler = (call: Call) => Response | Promise<Response>;

function fixture(
  overrides: Record<string, Handler> = {},
  options: Omit<LocalModelClientOptions, 'fetchImpl'> = {},
) {
  const calls: Call[] = [];
  const defaults: Record<string, Handler> = {
    '/api/version': () => json({ version: '0.18.0' }),
    '/api/tags': () => json({ models: [tag()] }),
    '/api/show': () => json(show()),
    '/api/chat': () => json(reply()),
  };
  const fetchImpl: FetchImplementation = async (input, init = {}) => {
    const call = {
      url: String(input),
      init,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    assert.equal(new URL(call.url).origin, OLLAMA_ENDPOINT);
    assert.equal(init.redirect, 'error');
    assert.equal(init.credentials, 'omit');
    assert.ok(init.signal instanceof AbortSignal);
    const path = new URL(call.url).pathname;
    const handler = overrides[path] ?? defaults[path];
    assert.ok(handler, `Unexpected API call: ${path}`);
    return handler(call);
  };
  return { client: createLocalModelClient({ ...options, fetchImpl }), calls };
}

function code(expected: LocalModelErrorCode) {
  return (error: unknown) => error instanceof LocalModelError && error.code === expected;
}

test('health only queries the fixed loopback endpoint', async () => {
  const { client, calls } = fixture();
  assert.deepEqual(await client.health(), { ok: true, version: '0.18.0' });
  assert.equal(calls[0]!.url, `${OLLAMA_ENDPOINT}/api/version`);
  assert.equal(calls.length, 1);
});

test('lists only models with confirmed local GGUF metadata', async () => {
  const { client, calls } = fixture({
    '/api/tags': () => json({ models: [tag(), tag('qwen3:cloud'), tag('local-alias:latest')] }),
    '/api/show': ({ body }) =>
      json(
        body?.model === MODEL
          ? show()
          : { remote_host: 'https://ollama.com', remote_model: 'qwen3' },
      ),
  });
  assert.deepEqual(await client.listModels(), [
    {
      name: MODEL,
      digest: DIGEST,
      sizeBytes: 2600000000,
      architecture: 'qwen3',
      parameterSize: '4B',
      quantization: 'Q4_K_M',
      contextLength: 32768,
    },
  ]);
  assert.equal(calls.filter((call) => call.body?.model === 'qwen3:cloud').length, 0);
});

test('chat verifies local metadata and digest, disables thinking/streaming, and returns metrics', async () => {
  const { client, calls } = fixture();
  const result = await client.chat(messages, MODEL, {
    expectedDigest: `sha256:${DIGEST}`,
    seed: 42,
  });
  assert.equal(result.content, reply().message.content);
  assert.equal(result.model, MODEL);
  assert.equal(result.digest, DIGEST);
  assert.equal(result.metrics.totalDurationMs, 2000);
  assert.equal(result.metrics.promptTokens, 24);
  assert.equal(result.metrics.completionTokens, 10);
  assert.equal(result.metrics.tokensPerSecond, 10);
  assert.ok(result.metrics.wallDurationMs >= 0);
  assert.deepEqual(
    calls.map((call) => new URL(call.url).pathname),
    ['/api/tags', '/api/show', '/api/chat'],
  );
  assert.deepEqual(calls[2]!.body, {
    model: MODEL,
    messages,
    options: { temperature: 0.7, num_ctx: 4096, num_predict: 384, seed: 42 },
    think: false,
    stream: false,
  });
});

test('refuses a configurable remote endpoint', () => {
  assert.throws(
    () => createLocalModelClient({ baseUrl: 'https://example.com' } as LocalModelClientOptions),
    code('INVALID_INPUT'),
  );
});

test('rejects URLs, registry paths, traversal, oversized names, and cloud suffixes before any request', async () => {
  for (const name of [
    'https://ollama.com/qwen',
    '//evil.test/model',
    '127.0.0.1:11434/qwen',
    'hf.co/org/model',
    '../qwen',
    'x'.repeat(161),
  ]) {
    const { client, calls } = fixture();
    await assert.rejects(client.chat(messages, name), code('INVALID_INPUT'));
    assert.equal(calls.length, 0);
  }
  for (const name of ['qwen3:cloud', 'qwen3:4b-cloud', 'qwen3-remote:latest']) {
    const { client, calls } = fixture();
    await assert.rejects(client.chat(messages, name), code('MODEL_NOT_LOCAL'));
    assert.equal(calls.length, 0);
  }
});

test('rejects redirect responses without following their Location', async () => {
  const { client, calls } = fixture({
    '/api/version': () =>
      new Response(null, { status: 302, headers: { Location: 'https://example.com' } }),
  });
  await assert.rejects(client.health(), code('REDIRECT_BLOCKED'));
  assert.equal(calls.length, 1);
});

test('rejects a fetch implementation reporting a non-local response URL', async () => {
  const { client } = fixture({
    '/api/version': () => {
      const response = json({ version: '0.18.0' });
      Object.defineProperty(response, 'url', { value: 'https://example.com/api/version' });
      return response;
    },
  });
  await assert.rejects(client.health(), code('REDIRECT_BLOCKED'));
});

test('a benign alias cannot hide remote/cloud metadata or a remote Modelfile', async () => {
  for (const details of [
    { ...show(), remote_host: 'https://ollama.com' },
    { ...show(), remote_model: 'some-model' },
    { ...show(), details: { ...show().details, source: 'cloud' } },
    { ...show(), model_info: { ...show().model_info, 'ollama.remote_host': 'https://ollama.com' } },
    { ...show(), modelfile: 'FROM qwen3:4b-cloud\n' },
  ]) {
    const { client, calls } = fixture({ '/api/show': () => json(details) });
    await assert.rejects(client.chat(messages, MODEL), code('MODEL_NOT_LOCAL'));
    assert.equal(
      calls.some((call) => call.url.endsWith('/api/chat')),
      false,
    );
  }
});

test('requires positive GGUF evidence, not just absence of a cloud suffix', async () => {
  for (const details of [
    { ...show(), model_info: {} },
    { ...show(), details: { format: 'unknown' } },
    { ...show(), capabilities: ['embedding'] },
  ]) {
    const { client, calls } = fixture({ '/api/show': () => json(details) });
    await assert.rejects(client.chat(messages, MODEL), code('MODEL_NOT_LOCAL'));
    assert.equal(
      calls.some((call) => call.url.endsWith('/api/chat')),
      false,
    );
  }
});

test('missing models fail without pull, install, or fallback calls', async () => {
  const { client, calls } = fixture({ '/api/tags': () => json({ models: [] }) });
  await assert.rejects(client.chat(messages, MODEL), code('MODEL_NOT_FOUND'));
  assert.deepEqual(
    calls.map((call) => new URL(call.url).pathname),
    ['/api/tags'],
  );
});

test('rechecks the expected manifest digest on every chat', async () => {
  let checks = 0;
  const { client, calls } = fixture({
    '/api/tags': () => json({ models: [tag(MODEL, ++checks === 1 ? DIGEST : 'b'.repeat(64))] }),
  });
  await client.chat(messages, MODEL, { expectedDigest: DIGEST });
  await assert.rejects(
    client.chat(messages, MODEL, { expectedDigest: DIGEST }),
    code('DIGEST_MISMATCH'),
  );
  assert.equal(checks, 2);
  assert.equal(calls.filter((call) => call.url.endsWith('/api/chat')).length, 1);
});

test('rejects invalid budgets, nonnumeric settings and unexpected options before requests', async () => {
  for (const settings of [
    { temperature: NaN },
    { temperature: Infinity },
    { numCtx: 4096.5 },
    { numPredict: -1 },
    { numPredict: 5000 },
    { seed: 2.5 },
    { temperature: '0.7' },
    { baseUrl: 'https://example.com' },
    { expectedDigest: 'short' },
  ]) {
    const { client, calls } = fixture();
    await assert.rejects(
      client.chat(messages, MODEL, settings as ChatSettings),
      code('INVALID_INPUT'),
    );
    assert.equal(calls.length, 0);
  }
});

test('rejects tool/image fields and oversized conversations', async () => {
  const { client, calls } = fixture();
  await assert.rejects(
    client.chat([{ ...messages[0], images: ['fake'] } as (typeof messages)[0]], MODEL),
    code('INVALID_INPUT'),
  );
  await assert.rejects(
    client.chat([{ role: 'user', content: 'x'.repeat(32769) }], MODEL),
    code('INVALID_INPUT'),
  );
  assert.equal(calls.length, 0);
});

test('rejects remote provenance in the generation response', async () => {
  const { client } = fixture({
    '/api/chat': () => json({ ...reply(), remote_host: 'https://ollama.com' }),
  });
  await assert.rejects(client.chat(messages, MODEL), code('MODEL_NOT_LOCAL'));
});

test('rejects invalid JSON, error responses and unexpected content types', async () => {
  for (const response of [
    new Response('{', { headers: { 'Content-Type': 'application/json' } }),
    json({ error: 'Do not expose this server payload.' }),
    new Response('<html>proxy</html>', { headers: { 'Content-Type': 'text/html' } }),
  ]) {
    const { client } = fixture({ '/api/version': () => response });
    await assert.rejects(client.health(), code('INVALID_RESPONSE'));
  }
  const { client } = fixture({
    '/api/version': () => new Response('sensitive error', { status: 500 }),
  });
  await assert.rejects(
    client.health(),
    (error: unknown) =>
      code('HTTP_ERROR')(error) && !(error as Error).message.includes('sensitive'),
  );
});

test('rejects incomplete replies, different models, tool calls and invalid metrics', async () => {
  for (const data of [
    { ...reply(), done: false },
    { ...reply(), model: 'other:4b' },
    { ...reply(), message: { role: 'assistant', content: '' } },
    {
      ...reply(),
      message: { ...reply().message, tool_calls: [{ function: { name: 'open_url' } }] },
    },
    { ...reply(), eval_count: -1 },
  ]) {
    const { client } = fixture({ '/api/chat': () => json(data) });
    await assert.rejects(client.chat(messages, MODEL), code('INVALID_RESPONSE'));
  }
});

test('enforces response byte limits even without a Content-Length header', async () => {
  const { client } = fixture(
    { '/api/version': () => json({ version: 'x'.repeat(1024) }) },
    { maxResponseBytes: 128 },
  );
  await assert.rejects(client.health(), code('RESPONSE_TOO_LARGE'));
});

test('pre-aborted calls never contact Ollama', async () => {
  const { client, calls } = fixture();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(client.chat(messages, MODEL, {}, controller.signal), code('ABORTED'));
  assert.equal(calls.length, 0);
});

test('cancels an in-flight request, even if an injected transport ignores AbortSignal', async () => {
  const controller = new AbortController();
  let observedSignal: AbortSignal | undefined;
  let notifyStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve;
  });
  const client = createLocalModelClient({
    fetchImpl: async (_input, init) => {
      observedSignal = init?.signal ?? undefined;
      notifyStarted();
      return new Promise<Response>(() => {});
    },
  });
  const pending = client.health(controller.signal);
  await started;
  controller.abort();
  await assert.rejects(pending, code('ABORTED'));
  assert.equal(observedSignal?.aborted, true);
});

test('times out without making a fallback request', async () => {
  let count = 0;
  const client = createLocalModelClient({
    timeoutMs: 10,
    fetchImpl: async () => {
      count += 1;
      return new Promise<Response>(() => {});
    },
  });
  await assert.rejects(client.health(), code('TIMEOUT'));
  assert.equal(count, 1);
});
