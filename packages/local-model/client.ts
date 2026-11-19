import { LocalModelError } from './types.ts';
import type {
  ChatMessage,
  ChatResult,
  ChatSettings,
  LocalModelClient,
  LocalModelClientOptions,
} from './types.ts';
import {
  assertLocalSource,
  canonicalName,
  chatInput,
  integer,
  inventory,
  localModel,
  metrics,
  modelName,
  object,
} from './validation.ts';

export const OLLAMA_ENDPOINT = 'http://127.0.0.1:11434' as const;
type ApiPath = '/api/version' | '/api/tags' | '/api/show' | '/api/chat';

function abortReason(signal: AbortSignal): LocalModelError {
  return signal.reason instanceof LocalModelError
    ? signal.reason
    : new LocalModelError('ABORTED', 'Local model request cancelled.');
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => {});
    return Promise.reject(abortReason(signal));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export function createLocalModelClient(options: LocalModelClientOptions = {}): LocalModelClient {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    Object.keys(options).some(
      (key) => !['fetchImpl', 'timeoutMs', 'maxResponseBytes'].includes(key),
    )
  ) {
    throw new LocalModelError(
      'INVALID_INPUT',
      'Only local client limits and a test fetch implementation may be configured.',
    );
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function')
    throw new LocalModelError('INVALID_INPUT', 'A fetch implementation is required.');
  const timeoutMs = integer(options.timeoutMs ?? 120000, 1, 600000, 'timeoutMs');
  const maxBytes = integer(options.maxResponseBytes ?? 2097152, 128, 8388608, 'maxResponseBytes');

  async function operation<T>(
    signal: AbortSignal | undefined,
    deadline: number,
    work: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (signal?.aborted) throw new LocalModelError('ABORTED', 'Local model request cancelled.');
    const controller = new AbortController();
    const cancel = () =>
      controller.abort(new LocalModelError('ABORTED', 'Local model request cancelled.'));
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(
      () => controller.abort(new LocalModelError('TIMEOUT', 'Local model request timed out.')),
      deadline,
    );
    try {
      return await abortable(work(controller.signal), controller.signal);
    } catch (error) {
      if (controller.signal.aborted) throw abortReason(controller.signal);
      if (error instanceof LocalModelError) throw error;
      throw new LocalModelError(
        'NETWORK_ERROR',
        'Cannot reach the local Ollama service at 127.0.0.1:11434.',
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      controller.abort();
    }
  }

  async function request(path: ApiPath, signal: AbortSignal, body?: unknown): Promise<unknown> {
    if (signal.aborted) throw abortReason(signal);
    const url = `${OLLAMA_ENDPOINT}${path}`;
    const response = await abortable(
      fetchImpl(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        signal,
      }),
      signal,
    );
    if (
      response.redirected ||
      response.type === 'opaqueredirect' ||
      (response.status >= 300 && response.status < 400) ||
      (response.url !== '' && response.url !== url)
    ) {
      void response.body?.cancel().catch(() => {});
      throw new LocalModelError(
        'REDIRECT_BLOCKED',
        'Redirects and non-local responses are disabled.',
      );
    }
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new LocalModelError('HTTP_ERROR', `Local Ollama returned HTTP ${response.status}.`);
    }
    if (
      !/^application\/(?:[a-z0-9.+-]*\+)?json(?:\s*;|$)/i.test(
        response.headers.get('content-type') ?? '',
      )
    ) {
      void response.body?.cancel().catch(() => {});
      throw new LocalModelError('INVALID_RESPONSE', 'Expected a JSON response from local Ollama.');
    }
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
      void response.body?.cancel().catch(() => {});
      throw new LocalModelError(
        'RESPONSE_TOO_LARGE',
        'Local Ollama response exceeds the configured byte limit.',
      );
    }
    if (!response.body)
      throw new LocalModelError('INVALID_RESPONSE', 'Local Ollama returned an empty response.');
    const reader = response.body.getReader();
    const buffer = new Uint8Array(maxBytes);
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await abortable(reader.read(), signal);
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes)
          throw new LocalModelError(
            'RESPONSE_TOO_LARGE',
            'Local Ollama response exceeds the configured byte limit.',
          );
        buffer.set(value, bytes - value.byteLength);
      }
    } finally {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    try {
      const value: unknown = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytes)),
      );
      const data = object(value, 'Ollama response');
      if (data.error !== undefined)
        throw new LocalModelError('INVALID_RESPONSE', 'Local Ollama reported an error.');
      return data;
    } catch (error) {
      if (error instanceof LocalModelError) throw error;
      throw new LocalModelError('INVALID_RESPONSE', 'Local Ollama returned invalid JSON or UTF-8.');
    }
  }

  return {
    health(signal) {
      return operation(signal, timeoutMs, async (active) => {
        const data = object(await request('/api/version', active), 'Version response');
        if (typeof data.version !== 'string' || !/^[0-9][a-z0-9.+_-]{0,79}$/i.test(data.version)) {
          throw new LocalModelError(
            'INVALID_RESPONSE',
            'Local Ollama returned an invalid version.',
          );
        }
        return { ok: true, version: data.version };
      });
    },
    listModels(signal) {
      return operation(signal, timeoutMs, async (active) => {
        const candidates = inventory(await request('/api/tags', active));
        const result = [];
        for (const entry of candidates) {
          try {
            result.push(
              localModel(
                entry,
                await request('/api/show', active, { model: entry.name, verbose: false }),
              ),
            );
          } catch (error) {
            if (error instanceof LocalModelError && error.code === 'MODEL_NOT_LOCAL') continue;
            throw error;
          }
        }
        return result;
      });
    },
    async chat(
      messages: readonly ChatMessage[],
      requestedModel: string,
      settings: ChatSettings = {},
      signal?: AbortSignal,
    ) {
      return operation(
        signal,
        integer(settings?.timeoutMs ?? timeoutMs, 1, 600000, 'timeoutMs'),
        async (active) => {
          const started = performance.now();
          modelName(requestedModel);
          const input = chatInput(messages, settings);
          const candidates = inventory(await request('/api/tags', active));
          const entry = candidates.find(
            (item) => canonicalName(item.name) === canonicalName(requestedModel),
          );
          if (!entry)
            throw new LocalModelError(
              'MODEL_NOT_FOUND',
              'The selected local model is not installed. No download was attempted.',
            );
          if (input.expectedDigest !== undefined && input.expectedDigest !== entry.digest) {
            throw new LocalModelError(
              'DIGEST_MISMATCH',
              'The installed model digest differs from the published persona model.',
            );
          }
          const selected = localModel(
            entry,
            await request('/api/show', active, { model: entry.name, verbose: false }),
          );
          const data = object(
            await request('/api/chat', active, {
              model: selected.name,
              messages: input.messages,
              options: input.options,
              think: false,
              stream: false,
            }),
            'Chat response',
          );
          assertLocalSource(data);
          if (
            typeof data.model !== 'string' ||
            canonicalName(data.model) !== canonicalName(selected.name) ||
            data.done !== true
          ) {
            throw new LocalModelError(
              'INVALID_RESPONSE',
              'Local Ollama returned an unfinished reply or a different model.',
            );
          }
          const message = object(data.message, 'Assistant message');
          if (
            message.role !== 'assistant' ||
            typeof message.content !== 'string' ||
            !message.content.trim() ||
            message.content.length > 131072 ||
            (message.tool_calls !== undefined &&
              (!Array.isArray(message.tool_calls) || message.tool_calls.length > 0))
          ) {
            throw new LocalModelError(
              'INVALID_RESPONSE',
              'Local Ollama did not return a bounded text-only assistant reply.',
            );
          }
          const result: ChatResult = {
            model: selected.name,
            digest: selected.digest,
            content: message.content,
            metrics: metrics(data, performance.now() - started),
          };
          if (typeof data.created_at === 'string') result.createdAt = data.created_at.slice(0, 80);
          if (typeof data.done_reason === 'string')
            result.doneReason = data.done_reason.slice(0, 80);
          return result;
        },
      );
    },
  };
}
