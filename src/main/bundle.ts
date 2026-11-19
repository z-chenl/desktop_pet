import { parsePersonaSnapshot } from '../../packages/persona-core/src/index.ts';
import type { CharacterBundle, ModelProfile } from '../shared/contracts.ts';

export function parseModelProfile(value: unknown): ModelProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('模型配置不是对象。');
  const m = value as Record<string, unknown>;
  if (
    typeof m.model !== 'string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(m.model) ||
    /cloud|https?:/i.test(m.model)
  )
    throw new Error('仅支持本地模型名称。');
  if (typeof m.digest !== 'string' || !/^(sha256:)?[a-f0-9]{64}$/i.test(m.digest))
    throw new Error('缺少有效的模型指纹。');
  if (
    typeof m.temperature !== 'number' ||
    !Number.isFinite(m.temperature) ||
    m.temperature < 0 ||
    m.temperature > 2
  )
    throw new Error('temperature 必须在 0–2 之间。');
  for (const [key, min, max] of [
    ['numCtx', 4096, 8192],
    ['numPredict', 32, 1024],
    ['seed', 0, 2147483647],
  ] as const) {
    if (
      typeof m[key] !== 'number' ||
      !Number.isInteger(m[key]) ||
      (m[key] as number) < min ||
      (m[key] as number) > max
    )
      throw new Error(`${key} 超出 M0 允许的范围。`);
  }
  if (
    Object.keys(m).some(
      (key) => !['model', 'digest', 'temperature', 'numCtx', 'numPredict', 'seed'].includes(key),
    )
  )
    throw new Error('模型配置包含不支持的字段。');
  return {
    model: m.model,
    digest: m.digest,
    temperature: m.temperature,
    numCtx: m.numCtx as number,
    numPredict: m.numPredict as number,
    seed: m.seed as number,
  };
}

/** Only publishable data belongs here; a friend's memory/history never enters this format. */
export function parseCharacterBundle(value: unknown): CharacterBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('角色文件格式错误。');
  const o = value as Record<string, unknown>;
  if (o.format !== 'orange-cat-character' || o.schemaVersion !== 1)
    throw new Error('不支持的角色文件版本。');
  if (
    Object.keys(o).some(
      (key) => !['format', 'schemaVersion', 'persona', 'modelProfile'].includes(key),
    )
  )
    throw new Error('角色文件包含额外字段；请使用专用角色导出功能。');
  return {
    format: 'orange-cat-character',
    schemaVersion: 1,
    persona: parsePersonaSnapshot(o.persona),
    modelProfile: parseModelProfile(o.modelProfile),
  };
}

export function serializeCharacterBundle(value: CharacterBundle): string {
  return JSON.stringify(parseCharacterBundle(value), null, 2);
}
