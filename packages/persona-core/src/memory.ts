import {
  LIMITS,
  choice,
  fail,
  freeze,
  identifier,
  keys,
  list,
  record,
  text,
  timestamp,
  uniqueIds,
  type ChatTurn,
  type ConversationHistory,
  type FriendMemoryStore,
  type MemoryEntry,
  type MemoryInput,
  type MemoryScope,
} from './schema.js';

function parseScope(value: MemoryScope): MemoryScope {
  const scope = record(value, 'scope');
  keys(scope, ['personaId', 'friendId'], 'scope');
  return {
    personaId: identifier(scope.personaId, 'scope.personaId'),
    friendId: identifier(scope.friendId, 'scope.friendId'),
  };
}

function assertScope(actual: MemoryScope, expected?: MemoryScope): void {
  if (!expected) return;
  const checked = parseScope(expected);
  if (actual.personaId !== checked.personaId || actual.friendId !== checked.friendId) {
    fail('SCOPE_MISMATCH', 'scope', 'data belongs to a different persona or friend');
  }
}

function parseMemoryInput(value: unknown, path = 'memory'): MemoryInput {
  const item = record(value, path);
  keys(item, ['id', 'category', 'text'], path);
  return {
    id: identifier(item.id, `${path}.id`),
    category: choice(item.category, ['preference', 'fact', 'event'], `${path}.category`),
    text: text(item.text, LIMITS.memoryText, `${path}.text`),
  };
}

function parseEntry(value: unknown, path: string): MemoryEntry {
  const item = record(value, path);
  keys(item, ['id', 'category', 'text', 'source', 'createdAt', 'updatedAt'], path);
  if (item.source !== 'manual')
    fail('INVALID_VALUE', `${path}.source`, 'only manually confirmed memories are supported');
  const input = parseMemoryInput({ id: item.id, category: item.category, text: item.text }, path);
  const createdAt = timestamp(item.createdAt, `${path}.createdAt`);
  const updatedAt = timestamp(item.updatedAt, `${path}.updatedAt`);
  if (updatedAt < createdAt)
    fail('INVALID_VALUE', `${path}.updatedAt`, 'update cannot precede creation');
  return freeze({ ...input, source: 'manual' as const, createdAt, updatedAt });
}

export function parseFriendMemoryStore(
  value: unknown,
  expectedScope?: MemoryScope,
): FriendMemoryStore {
  const store = record(value, 'memoryStore');
  keys(store, ['schemaVersion', 'kind', 'personaId', 'friendId', 'entries'], 'memoryStore');
  if (store.schemaVersion !== 1 || store.kind !== 'friendMemory') {
    fail('INVALID_VALUE', 'memoryStore', 'unsupported memory type or schema version');
  }
  const scope = parseScope({
    personaId: store.personaId as string,
    friendId: store.friendId as string,
  });
  assertScope(scope, expectedScope);
  const entries = list(store.entries, LIMITS.memoryEntries, 'memoryStore.entries', parseEntry);
  uniqueIds(entries, 'memoryStore.entries');
  return freeze({ schemaVersion: 1 as const, kind: 'friendMemory' as const, ...scope, entries });
}

export function createFriendMemoryStore(scope: MemoryScope): FriendMemoryStore {
  return parseFriendMemoryStore({
    schemaVersion: 1,
    kind: 'friendMemory',
    ...parseScope(scope),
    entries: [],
  });
}

/** Updates only the selected friend's data; persona snapshots are not inputs to this operation. */
export function upsertFriendMemory(
  store: FriendMemoryStore,
  scope: MemoryScope,
  value: MemoryInput,
  now: string,
): FriendMemoryStore {
  const checked = parseFriendMemoryStore(store, scope);
  const input = parseMemoryInput(value);
  const updatedAt = timestamp(now, 'memory.updatedAt');
  const existing = checked.entries.find((entry) => entry.id === input.id);
  if (existing && updatedAt < existing.updatedAt) {
    fail('INVALID_VALUE', 'memory.updatedAt', 'update cannot precede the current memory version');
  }
  const entry: MemoryEntry = {
    ...input,
    source: 'manual',
    createdAt: existing?.createdAt ?? updatedAt,
    updatedAt,
  };
  const entries = existing
    ? checked.entries.map((item) => (item.id === entry.id ? entry : item))
    : [...checked.entries, entry];
  return parseFriendMemoryStore({ ...checked, entries }, scope);
}

export function deleteFriendMemory(
  store: FriendMemoryStore,
  scope: MemoryScope,
  id: string,
): FriendMemoryStore {
  const checked = parseFriendMemoryStore(store, scope);
  const memoryId = identifier(id, 'memory.id');
  return parseFriendMemoryStore(
    { ...checked, entries: checked.entries.filter((item) => item.id !== memoryId) },
    scope,
  );
}

export function clearFriendMemory(store: FriendMemoryStore, scope: MemoryScope): FriendMemoryStore {
  const checked = parseFriendMemoryStore(store, scope);
  return createFriendMemoryStore({ personaId: checked.personaId, friendId: checked.friendId });
}

function parseTurn(value: unknown, path: string): ChatTurn {
  const turn = record(value, path);
  keys(turn, ['role', 'content'], path);
  return {
    role: choice(turn.role, ['user', 'assistant'], `${path}.role`),
    content: text(turn.content, LIMITS.turnText, `${path}.content`),
  };
}

export function parseConversationHistory(
  value: unknown,
  expectedScope?: MemoryScope,
): ConversationHistory {
  const history = record(value, 'history');
  keys(history, ['schemaVersion', 'kind', 'personaId', 'friendId', 'turns'], 'history');
  if (history.schemaVersion !== 1 || history.kind !== 'conversationHistory') {
    fail('INVALID_VALUE', 'history', 'unsupported history type or schema version');
  }
  const scope = parseScope({
    personaId: history.personaId as string,
    friendId: history.friendId as string,
  });
  assertScope(scope, expectedScope);
  const turns = list(history.turns, LIMITS.historyTurns, 'history.turns', parseTurn);
  return freeze({
    schemaVersion: 1 as const,
    kind: 'conversationHistory' as const,
    ...scope,
    turns,
  });
}

export function createConversationHistory(
  scope: MemoryScope,
  turns: readonly ChatTurn[] = [],
): ConversationHistory {
  return parseConversationHistory({
    schemaVersion: 1,
    kind: 'conversationHistory',
    ...parseScope(scope),
    turns,
  });
}

/** Retains the newest bounded history. This changes neither memories nor persona rules. */
export function appendConversationTurn(
  history: ConversationHistory,
  scope: MemoryScope,
  value: ChatTurn,
): ConversationHistory {
  const checked = parseConversationHistory(history, scope);
  const turn = parseTurn(value, 'turn');
  return createConversationHistory(scope, [...checked.turns, turn].slice(-LIMITS.historyTurns));
}
