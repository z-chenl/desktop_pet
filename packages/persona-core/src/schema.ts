/** Browser-safe, pure data types. Limits count JavaScript UTF-16 code units, not tokens. */
export const LIMITS = Object.freeze({
  id: 64,
  name: 80,
  summary: 1_200,
  rule: 400,
  rulesPerKind: 16,
  examples: 24,
  scenario: 240,
  exampleInput: 1_200,
  exampleResponse: 1_800,
  personaChars: 18_000,
  memoryEntries: 100,
  memoryText: 600,
  historyTurns: 40,
  turnText: 4_000,
  userInput: 4_000,
  promptMemories: 8,
  promptHistoryTurns: 12,
  defaultPromptChars: 5_000,
  maxPromptChars: 48_000,
});

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type Provenance = 'fictionalSample' | 'creatorProvided';

export interface PersonaExample {
  id: string;
  scenario: string;
  user: string;
  assistant: string;
  provenance: Provenance;
}

/** A manually editable draft. creatorProvided records a claim, not verified authorship. */
export interface PersonaDraft {
  personaId: string;
  name: string;
  summary: string;
  provenance: Provenance;
  speakingRules: string[];
  behaviorRules: string[];
  examples: PersonaExample[];
}

/** Validation + deep freezing provide application immutability, not cryptographic authenticity. */
export type PersonaSnapshot = DeepReadonly<
  PersonaDraft & {
    schemaVersion: 1;
    kind: 'personaSnapshot';
    revision: number;
    publishedAt: string;
  }
>;

export interface MemoryScope {
  personaId: string;
  friendId: string;
}

export type MemoryCategory = 'preference' | 'fact' | 'event';

export interface MemoryInput {
  id: string;
  category: MemoryCategory;
  text: string;
}

export type MemoryEntry = DeepReadonly<
  MemoryInput & {
    source: 'manual';
    createdAt: string;
    updatedAt: string;
  }
>;

export type FriendMemoryStore = DeepReadonly<
  MemoryScope & {
    schemaVersion: 1;
    kind: 'friendMemory';
    entries: MemoryEntry[];
  }
>;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type ConversationHistory = DeepReadonly<
  MemoryScope & {
    schemaVersion: 1;
    kind: 'conversationHistory';
    turns: ChatTurn[];
  }
>;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface BuildMessagesInput {
  persona: PersonaSnapshot;
  friendId: string;
  memory: FriendMemoryStore;
  history?: ConversationHistory;
  userInput: string;
  mode?: 'persona' | 'generic';
  maxPromptChars?: number;
}

export type PromptBundle = DeepReadonly<{
  messages: ChatMessage[];
  personaRef: string;
  friendId: string;
  mode: 'persona' | 'generic';
  selectedMemoryIds: string[];
  omittedMemoryCount: number;
  omittedHistoryTurns: number;
  characterCount: number;
}>;

export interface EvaluationScenario {
  id: string;
  title: string;
  input: string;
  checks: readonly string[];
  memorySetup: readonly MemoryInput[];
}

export type ValidationCode =
  | 'INVALID_TYPE'
  | 'INVALID_VALUE'
  | 'LIMIT_EXCEEDED'
  | 'SCOPE_MISMATCH'
  | 'REVISION_CONFLICT'
  | 'PROMPT_TOO_LARGE';

export class CoreValidationError extends Error {
  readonly code: ValidationCode;
  readonly path: string;

  constructor(code: ValidationCode, path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'CoreValidationError';
    this.code = code;
    this.path = path;
  }
}

export function fail(code: ValidationCode, path: string, message: string): never {
  throw new CoreValidationError(code, path, message);
}

/** Internal validators are exported for package modules; public consumers use parse functions. */
export function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail('INVALID_TYPE', path, 'expected a plain object');
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail('INVALID_TYPE', path, 'expected a plain object');
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor || !('value' in descriptor)) {
      return fail('INVALID_TYPE', path, 'symbol keys and accessor properties are not accepted');
    }
  }
  return value as Record<string, unknown>;
}

export function keys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  for (const key of Object.getOwnPropertyNames(value)) {
    if (!allowed.includes(key)) fail('INVALID_VALUE', `${path}.${key}`, 'unknown field');
  }
  for (const key of allowed) {
    if (!Object.hasOwn(value, key)) fail('INVALID_VALUE', `${path}.${key}`, 'missing field');
  }
}

export function text(value: unknown, maxLength: number, path: string): string {
  if (typeof value !== 'string') return fail('INVALID_TYPE', path, 'expected text');
  if (!value.trim()) return fail('INVALID_VALUE', path, 'text cannot be blank');
  if (value.length > maxLength)
    return fail('LIMIT_EXCEEDED', path, `maximum length is ${maxLength}`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    return fail('INVALID_VALUE', path, 'unsupported control character');
  }
  return value;
}

export function identifier(value: unknown, path: string): string {
  const result = text(value, LIMITS.id, path);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u.test(result)) {
    return fail('INVALID_VALUE', path, 'use ASCII letters, digits, dots, underscores or hyphens');
  }
  return result;
}

export function choice<const T extends readonly string[]>(
  value: unknown,
  options: T,
  path: string,
): T[number] {
  if (typeof value !== 'string' || !options.includes(value)) {
    return fail('INVALID_VALUE', path, `expected one of ${options.join(', ')}`);
  }
  return value;
}

export function integer(value: unknown, min: number, max: number, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    return fail('INVALID_VALUE', path, `expected an integer from ${min} to ${max}`);
  }
  return value;
}

export function timestamp(value: unknown, path: string): string {
  const result = text(value, 24, path);
  const date = new Date(result);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(result) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString() !== result
  ) {
    return fail('INVALID_VALUE', path, 'expected a valid UTC ISO timestamp with milliseconds');
  }
  return result;
}

export function list<T>(
  value: unknown,
  maxLength: number,
  path: string,
  parse: (item: unknown, path: string) => T,
): T[] {
  if (!Array.isArray(value)) return fail('INVALID_TYPE', path, 'expected an array');
  if (value.length > maxLength) return fail('LIMIT_EXCEEDED', path, `at most ${maxLength} items`);
  const result: T[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor) fail('INVALID_VALUE', `${path}[${index}]`, 'sparse arrays are not accepted');
    if (!('value' in descriptor))
      fail('INVALID_TYPE', `${path}[${index}]`, 'array accessors are not accepted');
    result.push(parse(descriptor.value, `${path}[${index}]`));
  }
  return result;
}

export function uniqueIds(items: readonly { readonly id: string }[], path: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) fail('INVALID_VALUE', path, `duplicate id ${item.id}`);
    seen.add(item.id);
  }
}

/** Only call on newly constructed, validated values; never freezes a caller's mutable draft. */
export function freeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}
