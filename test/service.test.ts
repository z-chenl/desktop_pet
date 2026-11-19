import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test, { type TestContext } from 'node:test';
import {
  buildMessages,
  createConversationHistory,
  createFriendMemoryStore,
  draftFromSnapshot,
  EVALUATION_SCENARIOS,
  publishPersona,
  upsertFriendMemory,
} from '../packages/persona-core/src/index.ts';
import { LocalModelError } from '../packages/local-model/index.ts';
import type {
  ChatMessage,
  ChatResult,
  ChatSettings,
  LocalModel,
  LocalModelClient,
} from '../packages/local-model/index.ts';
import { parseCharacterBundle, serializeCharacterBundle } from '../src/main/bundle.ts';
import { LabService } from '../src/main/service.ts';
import { DocumentStore } from '../src/main/store.ts';
import type { CharacterBundle, LabState, PublishInput } from '../src/shared/contracts.ts';

// All model results below are explicit test doubles. No network, download, or inference occurs.
const MOCK_MODEL = 'mock-local-model:tiny';
const MOCK_DIGEST = 'a'.repeat(64);
const MOCK_OUTPUT = '【MOCK ONLY】这是集成测试预设的回复，没有调用模型。';
const PUBLISH: PublishInput = {
  model: MOCK_MODEL,
  temperature: 0.35,
  numCtx: 4096,
  numPredict: 256,
  seed: 42,
};

interface MockCall {
  messages: readonly ChatMessage[];
  model: string;
  settings: ChatSettings;
  signal?: AbortSignal;
}

class MockLocalModelClient implements LocalModelClient {
  readonly calls: MockCall[] = [];
  inventory: LocalModel[] = [
    { name: MOCK_MODEL, digest: MOCK_DIGEST, sizeBytes: 1, architecture: 'mock' },
  ];
  behavior?: (call: MockCall) => Promise<ChatResult>;

  async health() {
    return { ok: true as const, version: '0.0.0-mock' };
  }
  async listModels() {
    return structuredClone(this.inventory);
  }
  async chat(
    messages: readonly ChatMessage[],
    model: string,
    settings: ChatSettings = {},
    signal?: AbortSignal,
  ) {
    const call: MockCall = {
      messages: structuredClone(messages),
      model,
      settings: structuredClone(settings),
      signal,
    };
    this.calls.push(call);
    if (this.behavior) return this.behavior(call);
    return mockResult(model);
  }
}

function mockResult(model = MOCK_MODEL): ChatResult {
  return {
    model,
    digest: MOCK_DIGEST,
    content: MOCK_OUTPUT,
    metrics: { wallDurationMs: 1, promptTokens: 10, completionTokens: 12 },
  };
}

function createLab(t: TestContext) {
  const store = new DocumentStore(':memory:');
  t.after(() => store.close());
  const model = new MockLocalModelClient();
  return { store, model, service: new LabService(store, model, ':memory:') };
}

function friend(state: LabState, name = '朋友 A') {
  const result = state.friends.find((item) => item.name === name);
  assert.ok(result, `${name} should exist`);
  return result;
}

function published(state: LabState): CharacterBundle {
  assert.ok(state.published);
  return state.published;
}

function capture(service: LabService): string {
  return JSON.stringify(service.getState());
}

test('service: publishing freezes a version while draft edits and manual corrections remain unpublished', async (t) => {
  const { service, store } = createLab(t);
  const firstState = await service.publish(PUBLISH);
  const first = published(firstState);
  const firstSerialized = serializeCharacterBundle(first);
  const draft = service.getState().draft;
  draft.name = '仅草稿中的新名字';
  service.saveDraft(draft);
  assert.equal(serializeCharacterBundle(published(service.getState())), firstSerialized);
  const target = friend(service.getState());
  await service.chat({ friendId: target.id, mode: 'persona', input: '这是一个人工修正测试。' });
  const record = service.getState().records[0];
  assert.ok(record);
  service.correct(record.id, '这是创作者手工输入的修正，不是自动学习。');
  assert.equal(serializeCharacterBundle(published(service.getState())), firstSerialized);
  assert.ok(
    service
      .getState()
      .draft.examples.some(
        (example) =>
          example.id === `correction-${record.id}` && example.provenance === 'creatorProvided',
      ),
  );
  const second = published(await service.publish(PUBLISH));
  assert.equal(second.persona.revision, 2);
  assert.equal(second.persona.name, draft.name);
  assert.equal(store.list('releases').length, 2);
  assert.equal(
    serializeCharacterBundle(store.get<CharacterBundle>('releases', '00000001')!),
    firstSerialized,
  );
  assert.equal(friend(service.getState()).history.turns.length, 0);
});

test('service: friend memory and conversation references never cross friend boundaries', async (t) => {
  const { service, model } = createLab(t);
  const state = await service.publish(PUBLISH);
  const alice = friend(state);
  const bob = friend(state, '朋友 B');
  service.saveMemory({
    friendId: alice.id,
    id: 'alice-memory',
    text: 'ALICE_PRIVATE_SENTINEL 喜欢温水。',
  });
  service.saveMemory({
    friendId: bob.id,
    id: 'bob-memory',
    text: 'BOB_PRIVATE_SENTINEL 喜欢苏打水。',
  });
  const frozenPersona = serializeCharacterBundle(published(service.getState()));
  await service.chat({
    friendId: alice.id,
    mode: 'persona',
    input: 'ALICE_HISTORY_SENTINEL 我喜欢什么饮料？',
  });
  const aliceCall = model.calls.at(-1)!;
  const alicePrompt = JSON.stringify(aliceCall.messages);
  assert.ok(alicePrompt.includes('ALICE_PRIVATE_SENTINEL'));
  assert.ok(!alicePrompt.includes('BOB_PRIVATE_SENTINEL'));
  await service.chat({ friendId: bob.id, mode: 'persona', input: '我喜欢什么饮料？' });
  const bobPrompt = JSON.stringify(model.calls.at(-1)!.messages);
  assert.ok(bobPrompt.includes('BOB_PRIVATE_SENTINEL'));
  assert.ok(!bobPrompt.includes('ALICE_PRIVATE_SENTINEL'));
  assert.ok(!bobPrompt.includes('ALICE_HISTORY_SENTINEL'));
  service.deleteMemory(alice.id, 'alice-memory');
  const after = service.getState();
  assert.equal(friend(after).memory.entries.length, 0);
  assert.equal(friend(after).history.turns.length, 0);
  assert.equal(friend(after, '朋友 B').memory.entries.length, 1);
  assert.equal(friend(after, '朋友 B').history.turns.length, 2);
  assert.ok(after.records.every((record) => record.friendId === bob.id));
  assert.equal(serializeCharacterBundle(published(after)), frozenPersona);
});

test('service: model failures and failed history validation leave no partial record or turn', async (t) => {
  const { service, model } = createLab(t);
  const state = await service.publish(PUBLISH);
  const target = friend(state);
  await service.chat({ friendId: target.id, mode: 'persona', input: '保留这轮已经成功的记录。' });
  const before = capture(service);
  model.behavior = async () => {
    throw new LocalModelError('NETWORK_ERROR', 'MOCK: local service failed');
  };
  await assert.rejects(
    service.chat({ friendId: target.id, mode: 'persona', input: '这轮应失败。' }),
    /MOCK: local service failed/,
  );
  assert.equal(capture(service), before);
  // The adapter may accept more output than bounded history. A later validation failure must roll back records too.
  model.behavior = async () => ({ ...mockResult(), content: '长'.repeat(4_001) });
  await assert.rejects(
    service.chat({ friendId: target.id, mode: 'persona', input: '这个假回复超出历史长度。' }),
    /maximum length/,
  );
  assert.equal(capture(service), before);
  model.behavior = undefined;
  await service.chat({ friendId: target.id, mode: 'persona', input: '失败后仍可正常试聊。' });
  assert.equal(service.getState().records.length, 2);
});

test('service: cancellation ignores even a late successful mock result and releases the busy guard', async (t) => {
  const { service, model } = createLab(t);
  const state = await service.publish(PUBLISH);
  const target = friend(state);
  const before = capture(service);
  let complete!: (value: ChatResult) => void;
  const result = new Promise<ChatResult>((resolve) => {
    complete = resolve;
  });
  model.behavior = async () => result; // Deliberately ignores AbortSignal to exercise the service's own guard.
  const pending = service.chat({ friendId: target.id, mode: 'persona', input: '这一轮随后取消。' });
  const outcome = assert.rejects(pending, /停止生成/);
  assert.equal(model.calls.length, 1);
  assert.throws(
    () => service.saveMemory({ friendId: target.id, text: '不能在生成过程中并发改数据' }),
    /正在生成/,
  );
  service.cancel();
  assert.equal(model.calls[0]!.signal?.aborted, true);
  complete(mockResult());
  await outcome;
  assert.equal(capture(service), before);
  model.behavior = undefined;
  await service.chat({ friendId: target.id, mode: 'persona', input: '取消后重新试聊。' });
  assert.equal(service.getState().records.length, 1);
  assert.equal(friend(service.getState()).history.turns.length, 2);
});

test('service: the exact published model fingerprint and only supported generation settings reach the adapter', async (t) => {
  const { service, model } = createLab(t);
  const state = await service.publish(PUBLISH);
  const target = friend(state);
  await service.chat({
    friendId: target.id,
    mode: 'persona',
    input: '使用发布时的同一套模型参数。',
  });
  const call = model.calls[0]!;
  assert.equal(call.model, MOCK_MODEL);
  assert.deepEqual(call.settings, {
    temperature: PUBLISH.temperature,
    numCtx: PUBLISH.numCtx,
    numPredict: PUBLISH.numPredict,
    seed: PUBLISH.seed,
    expectedDigest: MOCK_DIGEST,
  });
  const record = service.getState().records[0]!;
  assert.equal(record.model, MOCK_MODEL);
  assert.equal(record.digest, MOCK_DIGEST);
  assert.equal(record.personaRevision, 1);
});

test('service: generic controls are recorded separately and do not alter persona conversation history', async (t) => {
  const { service, model } = createLab(t);
  const state = await service.publish(PUBLISH);
  const target = friend(state);
  await service.chat({ friendId: target.id, mode: 'persona', input: 'PERSONA_HISTORY_ONLY' });
  const before = friend(service.getState()).history;
  await service.chat({ friendId: target.id, mode: 'generic', input: '相同场景的通用表达测试。' });
  const after = service.getState();
  assert.deepEqual(friend(after).history, before);
  assert.equal(after.records.filter((record) => record.mode === 'generic').length, 1);
  assert.ok(!JSON.stringify(model.calls.at(-1)!.messages).includes('PERSONA_HISTORY_ONLY'));
});

test('service: character exports contain only the publishable prototype and model profile', async (t) => {
  const { service } = createLab(t);
  const state = await service.publish(PUBLISH);
  const target = friend(state);
  service.saveMemory({ friendId: target.id, text: 'PRIVATE_MEMORY_EXPORT_SENTINEL' });
  await service.chat({
    friendId: target.id,
    mode: 'persona',
    input: 'PRIVATE_HISTORY_EXPORT_SENTINEL',
  });
  const serialized = serializeCharacterBundle(published(service.getState()));
  const decoded = JSON.parse(serialized) as Record<string, unknown>;
  assert.deepEqual(Object.keys(decoded).sort(), [
    'format',
    'modelProfile',
    'persona',
    'schemaVersion',
  ]);
  assert.ok(!serialized.includes('PRIVATE_MEMORY_EXPORT_SENTINEL'));
  assert.ok(!serialized.includes('PRIVATE_HISTORY_EXPORT_SENTINEL'));
  assert.ok(!serialized.includes(target.id));
  assert.ok(!serialized.includes(MOCK_OUTPUT));
  assert.deepEqual(parseCharacterBundle(decoded), published(service.getState()));
  assert.throws(
    () => parseCharacterBundle({ ...decoded, friends: service.getState().friends }),
    /额外字段/,
  );
});

test('service: importing a newer prototype preserves each friend memory, resets history, and rejects duplicate or dirty imports atomically', async (t) => {
  const { service, store } = createLab(t);
  const state = await service.publish(PUBLISH);
  const first = published(state);
  const alice = friend(state);
  const bob = friend(state, '朋友 B');
  service.saveMemory({ friendId: alice.id, text: 'A 的独立记忆' });
  service.saveMemory({ friendId: bob.id, text: 'B 的独立记忆' });
  await service.chat({ friendId: alice.id, mode: 'persona', input: '旧原型产生的上下文。' });
  const before = service.getState();
  const draft = draftFromSnapshot(first.persona);
  draft.name = '创作者发布的第二版';
  const newer: CharacterBundle = {
    ...first,
    persona: publishPersona(draft, {
      previous: first.persona,
      revision: 2,
      publishedAt: new Date().toISOString(),
    }),
    modelProfile: { ...first.modelProfile, seed: 7 },
  };
  const after = service.importCharacter(JSON.parse(serializeCharacterBundle(newer)) as unknown);
  assert.equal(published(after).persona.revision, 2);
  assert.equal(after.draft.name, draft.name);
  assert.deepEqual(friend(after).memory, friend(before).memory);
  assert.deepEqual(friend(after, '朋友 B').memory, friend(before, '朋友 B').memory);
  assert.ok(after.friends.every((item) => item.history.turns.length === 0));
  assert.deepEqual(after.records, before.records);
  assert.equal(store.list('releases').length, 2);
  const stable = capture(service);
  assert.throws(() => service.importCharacter(newer), /必须高于/);
  assert.equal(capture(service), stable);
  assert.throws(() => service.importCharacter(first), /必须高于/);
  assert.equal(capture(service), stable);
  assert.throws(
    () => service.importCharacter({ ...newer, memory: { text: 'unexpected private data' } }),
    /额外字段/,
  );
  assert.equal(capture(service), stable);
  assert.throws(() => service.importCharacter({ ...newer, schemaVersion: 99 }), /不支持/);
  assert.equal(capture(service), stable);
});

test('service: default persona and every evaluation fixture fit a 4,000-character budget without losing the fixed persona', async (t) => {
  const { service } = createLab(t);
  const state = await service.publish(PUBLISH);
  const persona = published(state).persona;
  const scope = { personaId: persona.personaId, friendId: friend(state).id };
  for (const scenario of EVALUATION_SCENARIOS) {
    let memory = createFriendMemoryStore(scope);
    for (const item of scenario.memorySetup)
      memory = upsertFriendMemory(memory, scope, item, '2026-11-19T00:00:00.000Z');
    const prompt = buildMessages({
      persona,
      friendId: scope.friendId,
      memory,
      history: createConversationHistory(scope),
      userInput: scenario.input,
      maxPromptChars: 4_000,
    });
    assert.ok(prompt.characterCount <= 4_000);
    assert.equal(prompt.omittedMemoryCount, 0);
    assert.ok(prompt.messages[0]!.content.includes(persona.summary));
    assert.ok(prompt.messages[0]!.content.includes(persona.examples[0]!.assistant));
  }
});

test('store: SQLite reopening preserves drafts, published versions, friend memories, histories and evaluations without duplicate friends', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'orange-cat-service-test-'));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const filename = join(directory, 'lab.sqlite');
  const store = new DocumentStore(filename);
  let expected: LabState;
  try {
    const service = new LabService(store, new MockLocalModelClient(), filename);
    const state = await service.publish(PUBLISH);
    const target = friend(state);
    service.saveMemory({ friendId: target.id, text: '重启后保留的记忆' });
    await service.chat({ friendId: target.id, mode: 'persona', input: '重启后保留的会话。' });
    const draft = service.getState().draft;
    draft.name = '尚未发布但应持久保存的草稿';
    service.saveDraft(draft);
    expected = service.getState();
  } finally {
    store.close();
  }
  const reopened = new DocumentStore(filename);
  try {
    const service = new LabService(reopened, new MockLocalModelClient(), filename);
    assert.deepEqual(service.getState(), expected);
    assert.equal(service.getState().friends.length, 2);
    assert.equal(reopened.list('releases').length, 1);
  } finally {
    reopened.close();
  }
});

test('store: a newer SQLite schema is refused without changing its schema, sentinel data or journal mode', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'orange-cat-new-schema-test-'));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const filename = join(directory, 'future.sqlite');
  const newer = new DatabaseSync(filename);
  newer.exec(
    "PRAGMA journal_mode = DELETE; CREATE TABLE sentinel (value TEXT NOT NULL); INSERT INTO sentinel VALUES ('future-data'); PRAGMA user_version = 99;",
  );
  newer.close();
  assert.throws(() => new DocumentStore(filename), /更新版本/);
  const inspection = new DatabaseSync(filename);
  try {
    assert.equal(
      (inspection.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
      99,
    );
    assert.equal(
      (inspection.prepare('SELECT value FROM sentinel').get() as { value: string }).value,
      'future-data',
    );
    assert.equal(
      (inspection.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode,
      'delete',
    );
    assert.equal(
      inspection.prepare("SELECT name FROM sqlite_master WHERE name = 'documents'").get(),
      undefined,
    );
  } finally {
    inspection.close();
  }
});
