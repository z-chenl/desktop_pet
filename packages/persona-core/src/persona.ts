import {
  LIMITS,
  choice,
  fail,
  freeze,
  identifier,
  integer,
  keys,
  list,
  record,
  text,
  timestamp,
  uniqueIds,
  type PersonaDraft,
  type PersonaExample,
  type PersonaSnapshot,
} from './schema.js';

const DRAFT_KEYS = [
  'personaId',
  'name',
  'summary',
  'provenance',
  'speakingRules',
  'behaviorRules',
  'examples',
] as const;
const SNAPSHOT_KEYS = [...DRAFT_KEYS, 'schemaVersion', 'kind', 'revision', 'publishedAt'] as const;

function parseExample(value: unknown, path: string): PersonaExample {
  const item = record(value, path);
  keys(item, ['id', 'scenario', 'user', 'assistant', 'provenance'], path);
  return {
    id: identifier(item.id, `${path}.id`),
    scenario: text(item.scenario, LIMITS.scenario, `${path}.scenario`),
    user: text(item.user, LIMITS.exampleInput, `${path}.user`),
    assistant: text(item.assistant, LIMITS.exampleResponse, `${path}.assistant`),
    provenance: choice(
      item.provenance,
      ['fictionalSample', 'creatorProvided'],
      `${path}.provenance`,
    ),
  };
}

/** Returns a fresh mutable draft, suitable for an editor. No automatic learning occurs. */
export function parsePersonaDraft(value: unknown): PersonaDraft {
  const draft = record(value, 'persona');
  keys(draft, DRAFT_KEYS, 'persona');
  const result: PersonaDraft = {
    personaId: identifier(draft.personaId, 'persona.personaId'),
    name: text(draft.name, LIMITS.name, 'persona.name'),
    summary: text(draft.summary, LIMITS.summary, 'persona.summary'),
    provenance: choice(
      draft.provenance,
      ['fictionalSample', 'creatorProvided'],
      'persona.provenance',
    ),
    speakingRules: list(
      draft.speakingRules,
      LIMITS.rulesPerKind,
      'persona.speakingRules',
      (item, path) => text(item, LIMITS.rule, path),
    ),
    behaviorRules: list(
      draft.behaviorRules,
      LIMITS.rulesPerKind,
      'persona.behaviorRules',
      (item, path) => text(item, LIMITS.rule, path),
    ),
    examples: list(draft.examples, LIMITS.examples, 'persona.examples', parseExample),
  };
  uniqueIds(result.examples, 'persona.examples');
  if (JSON.stringify(result).length > LIMITS.personaChars) {
    fail(
      'LIMIT_EXCEEDED',
      'persona',
      `combined persona must fit within ${LIMITS.personaChars} characters`,
    );
  }
  return result;
}

/** Validates the shape and copies/freeze data. Does NOT prove who authored a file. */
export function parsePersonaSnapshot(value: unknown): PersonaSnapshot {
  const snapshot = record(value, 'snapshot');
  keys(snapshot, SNAPSHOT_KEYS, 'snapshot');
  if (snapshot.schemaVersion !== 1 || snapshot.kind !== 'personaSnapshot') {
    fail('INVALID_VALUE', 'snapshot', 'unsupported snapshot type or schema version');
  }
  const draft = parsePersonaDraft(
    Object.fromEntries(DRAFT_KEYS.map((key) => [key, snapshot[key]])),
  );
  return freeze({
    ...draft,
    schemaVersion: 1 as const,
    kind: 'personaSnapshot' as const,
    revision: integer(snapshot.revision, 1, Number.MAX_SAFE_INTEGER, 'snapshot.revision'),
    publishedAt: timestamp(snapshot.publishedAt, 'snapshot.publishedAt'),
  });
}

export interface PublishPersonaOptions {
  revision: number;
  publishedAt: string;
  previous?: PersonaSnapshot;
}

/** Publishing is an explicit creator action; calling it never modifies an older snapshot. */
export function publishPersona(
  draft: PersonaDraft,
  options: PublishPersonaOptions,
): PersonaSnapshot {
  record(options, 'publish');
  const checked = parsePersonaDraft(draft);
  const revision = integer(options.revision, 1, Number.MAX_SAFE_INTEGER, 'publish.revision');
  const publishedAt = timestamp(options.publishedAt, 'publish.publishedAt');
  if (options.previous !== undefined) {
    const previous = parsePersonaSnapshot(options.previous);
    if (previous.personaId !== checked.personaId) {
      fail(
        'SCOPE_MISMATCH',
        'publish.previous',
        'cannot use another persona as the previous version',
      );
    }
    if (revision !== previous.revision + 1) {
      fail(
        'REVISION_CONFLICT',
        'publish.revision',
        'revision must be the previous revision plus one',
      );
    }
    if (publishedAt < previous.publishedAt) {
      fail(
        'INVALID_VALUE',
        'publish.publishedAt',
        'publication cannot precede the previous version',
      );
    }
  } else if (revision !== 1) {
    fail('REVISION_CONFLICT', 'publish.revision', 'the first published revision must be one');
  }
  return parsePersonaSnapshot({
    ...checked,
    schemaVersion: 1,
    kind: 'personaSnapshot',
    revision,
    publishedAt,
  });
}

export function draftFromSnapshot(value: PersonaSnapshot): PersonaDraft {
  const snapshot = parsePersonaSnapshot(value);
  return parsePersonaDraft(Object.fromEntries(DRAFT_KEYS.map((key) => [key, snapshot[key]])));
}

export function personaReference(value: PersonaSnapshot): string {
  const snapshot = parsePersonaSnapshot(value);
  return `${snapshot.personaId}@${snapshot.revision}`;
}

export function serializePersonaSnapshot(value: PersonaSnapshot): string {
  return JSON.stringify(parsePersonaSnapshot(value), null, 2);
}

/** Entirely invented development data, deliberately not presented as Chen's real habits. */
export function createFictionalSampleDraft(): PersonaDraft {
  return parsePersonaDraft({
    personaId: 'orange-cat-demo',
    name: '橘猫 · 虚构表达样例',
    summary:
      '用于验证本地聊天、性格编辑与记忆隔离的橘猫占位原型。这些表达由开发示例虚构，尚未代表 Chen 的真实说话习惯。',
    provenance: 'fictionalSample',
    speakingRules: [
      '用自然简洁的中文，通常回复一至三句。',
      '先回应对方眼前的感受，再给一个具体的小建议；避免长篇说教。',
      '可以轻微打趣，但不嘲笑对方，也不把每句话都加上猫叫。',
    ],
    behaviorRules: [
      '不知道的个人经历就明确说不知道，不虚构共同回忆。',
      '朋友可以告诉你自己的偏好，但这些信息不改变发布的角色原型。',
    ],
    examples: [
      {
        id: 'demo-procrastination',
        scenario: '对方为拖延自责',
        user: '我又拖延了，什么都没做。',
        assistant: '先别给自己判刑。打开文件做五分钟，今天先从这一步算起。',
        provenance: 'fictionalSample',
      },
      {
        id: 'demo-celebration',
        scenario: '对方分享一个小进展',
        user: '我终于把第一版做出来了！',
        assistant: '行啊，第一步最难，你已经迈过去了。先存个档，再好好得意一会儿。',
        provenance: 'fictionalSample',
      },
    ],
  });
}
