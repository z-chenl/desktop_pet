import { LocalModelError } from './types.ts';
import type { ChatMessage, ChatMetrics, ChatSettings, LocalModel } from './types.ts';

type JsonObject = Record<string, unknown>;
export type InventoryModel = Omit<LocalModel, 'architecture'> & { raw: JsonObject };

export function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LocalModelError('INVALID_RESPONSE', `${label} must be a JSON object.`);
  }
  return value as JsonObject;
}

export function integer(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new LocalModelError(
      'INVALID_INPUT',
      `${label} must be an integer from ${min} through ${max}.`,
    );
  }
  return value;
}

export function modelName(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 160 ||
    !/^(?:[a-z0-9][a-z0-9_-]{0,63}\/)?[a-z0-9][a-z0-9_.-]{0,95}(?::[a-z0-9][a-z0-9_.-]{0,63})?$/i.test(
      value,
    )
  ) {
    throw new LocalModelError(
      'INVALID_INPUT',
      'Use an installed local model name, not a URL, registry path, or file path.',
    );
  }
  if (/(?:^|[/:._-])(?:cloud|remote)(?=$|[/:._-])/i.test(value)) {
    throw new LocalModelError('MODEL_NOT_LOCAL', 'Cloud and remote model names are disabled.');
  }
  return value;
}

export function canonicalName(value: string): string {
  const name = modelName(value).toLowerCase();
  return name.includes(':') ? name : `${name}:latest`;
}

export function digest(value: unknown, response = false): string {
  if (typeof value !== 'string' || !/^(?:sha256:)?[a-f0-9]{64}$/i.test(value)) {
    throw new LocalModelError(
      response ? 'INVALID_RESPONSE' : 'INVALID_INPUT',
      'A full SHA-256 model manifest digest is required.',
    );
  }
  return value.toLowerCase().replace(/^sha256:/, '');
}

/** Inspect metadata keys, never prompt/template prose, for upstream-routing evidence. */
export function assertLocalSource(value: JsonObject): void {
  const pending: unknown[] = [value];
  let visited = 0;
  while (pending.length) {
    const item = pending.pop();
    if (!item || typeof item !== 'object') continue;
    if (++visited > 4096)
      throw new LocalModelError('INVALID_RESPONSE', 'Model metadata is too complex.');
    for (const [key, field] of Object.entries(item)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const present = field !== undefined && field !== null && field !== false && field !== '';
      if (present && (normalized.includes('remote') || normalized.includes('cloud'))) {
        throw new LocalModelError(
          'MODEL_NOT_LOCAL',
          'The local Ollama service reported a cloud or remote model source.',
        );
      }
      if (
        typeof field === 'string' &&
        /^(?:source|sourcetype|provider|host|baseurl|endpoint|origin|parentmodel)$/.test(
          normalized,
        ) &&
        (/https?:\/\//i.test(field) || /(?:^|[/:._-])(?:cloud|remote)(?=$|[/:._-])/i.test(field))
      ) {
        throw new LocalModelError(
          'MODEL_NOT_LOCAL',
          'The model metadata points to a remote source.',
        );
      }
      if (field && typeof field === 'object') pending.push(field);
    }
  }
  if (typeof value.modelfile === 'string') {
    for (const line of value.modelfile.split('\n')) {
      if (
        /^\s*REMOTE_(?:HOST|MODEL)\s+\S/i.test(line) ||
        /^\s*FROM\s+(?:https?:\/\/|\S*(?:[:._-](?:cloud|remote))(?:\s|$))/i.test(line)
      ) {
        throw new LocalModelError(
          'MODEL_NOT_LOCAL',
          'The model definition contains a remote source.',
        );
      }
    }
  }
}

export function inventory(value: unknown): InventoryModel[] {
  const data = object(value, 'Model inventory');
  if (!Array.isArray(data.models) || data.models.length > 128) {
    throw new LocalModelError(
      'INVALID_RESPONSE',
      'The local model inventory must contain at most 128 models.',
    );
  }
  const models: InventoryModel[] = [];
  const seen = new Set<string>();
  for (const entry of data.models) {
    const raw = object(entry, 'Model entry');
    try {
      const name = modelName(raw.name ?? raw.model);
      assertLocalSource(raw);
      if (raw.model !== undefined && canonicalName(modelName(raw.model)) !== canonicalName(name)) {
        throw new LocalModelError(
          'INVALID_RESPONSE',
          'The model inventory contains inconsistent names.',
        );
      }
      const key = canonicalName(name);
      if (seen.has(key))
        throw new LocalModelError(
          'INVALID_RESPONSE',
          'The model inventory contains duplicate names.',
        );
      seen.add(key);
      if (typeof raw.size !== 'number' || !Number.isSafeInteger(raw.size) || raw.size <= 0) {
        throw new LocalModelError(
          'MODEL_NOT_LOCAL',
          'The model has no positive local weight size.',
        );
      }
      models.push({ name, digest: digest(raw.digest, true), sizeBytes: raw.size, raw });
    } catch (error) {
      if (error instanceof LocalModelError && error.code === 'MODEL_NOT_LOCAL') continue;
      throw error;
    }
  }
  return models;
}

export function localModel(entry: InventoryModel, value: unknown): LocalModel {
  const data = object(value, 'Model details');
  assertLocalSource(data);
  const details = object(data.details, 'Model format details');
  const info = object(data.model_info, 'GGUF model metadata');
  const architecture = info['general.architecture'];
  const fileType = info['general.file_type'];
  if (
    details.format !== 'gguf' ||
    typeof architecture !== 'string' ||
    !/^[a-z0-9_.-]{1,80}$/i.test(architecture) ||
    typeof fileType !== 'number' ||
    !Number.isSafeInteger(fileType) ||
    fileType < 0
  ) {
    throw new LocalModelError(
      'MODEL_NOT_LOCAL',
      'Positive local GGUF metadata is required before inference.',
    );
  }
  if (
    data.capabilities !== undefined &&
    (!Array.isArray(data.capabilities) || !data.capabilities.includes('completion'))
  ) {
    throw new LocalModelError(
      'MODEL_NOT_LOCAL',
      'This model does not expose local text-completion capability.',
    );
  }
  const result: LocalModel = {
    name: entry.name,
    digest: entry.digest,
    sizeBytes: entry.sizeBytes,
    architecture,
  };
  if (typeof details.parameter_size === 'string')
    result.parameterSize = details.parameter_size.slice(0, 80);
  if (typeof details.quantization_level === 'string')
    result.quantization = details.quantization_level.slice(0, 80);
  const context = info[`${architecture}.context_length`];
  if (typeof context === 'number' && Number.isSafeInteger(context) && context > 0)
    result.contextLength = context;
  return result;
}

export function chatInput(messages: readonly ChatMessage[], settings: ChatSettings) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 128) {
    throw new LocalModelError('INVALID_INPUT', 'Provide between 1 and 128 text messages.');
  }
  let characters = 0;
  const safeMessages = messages.map((message) => {
    if (
      !message ||
      !['system', 'user', 'assistant'].includes(message.role) ||
      typeof message.content !== 'string' ||
      message.content.length > 32768 ||
      Object.keys(message).some((key) => !['role', 'content'].includes(key))
    ) {
      throw new LocalModelError(
        'INVALID_INPUT',
        'Messages must contain only a supported role and bounded text content.',
      );
    }
    characters += message.content.length;
    return { role: message.role, content: message.content };
  });
  if (characters === 0 || characters > 131072)
    throw new LocalModelError('INVALID_INPUT', 'The conversation text is empty or too large.');
  if (
    !settings ||
    typeof settings !== 'object' ||
    Array.isArray(settings) ||
    Object.keys(settings).some(
      (key) =>
        !['temperature', 'numCtx', 'numPredict', 'seed', 'timeoutMs', 'expectedDigest'].includes(
          key,
        ),
    )
  ) {
    throw new LocalModelError('INVALID_INPUT', 'Unsupported local generation setting.');
  }
  const temperature = settings.temperature ?? 0.7;
  if (
    typeof temperature !== 'number' ||
    !Number.isFinite(temperature) ||
    temperature < 0 ||
    temperature > 2
  ) {
    throw new LocalModelError(
      'INVALID_INPUT',
      'temperature must be a finite number between 0 and 2.',
    );
  }
  const options: Record<string, number> = {
    temperature,
    num_ctx: integer(settings.numCtx ?? 4096, 256, 32768, 'numCtx'),
    num_predict: integer(settings.numPredict ?? 384, 1, 4096, 'numPredict'),
  };
  if (settings.seed !== undefined) options.seed = integer(settings.seed, 0, 2147483647, 'seed');
  return {
    messages: safeMessages,
    options,
    expectedDigest:
      settings.expectedDigest === undefined ? undefined : digest(settings.expectedDigest),
  };
}

export function metrics(data: JsonObject, wallDurationMs: number): ChatMetrics {
  const result: ChatMetrics = { wallDurationMs };
  for (const [field, target, divisor] of [
    ['total_duration', 'totalDurationMs', 1e6],
    ['load_duration', 'loadDurationMs', 1e6],
    ['prompt_eval_duration', 'promptEvalDurationMs', 1e6],
    ['eval_duration', 'evalDurationMs', 1e6],
    ['prompt_eval_count', 'promptTokens', 1],
    ['eval_count', 'completionTokens', 1],
  ] as const) {
    const value = data[field];
    if (value !== undefined) {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throw new LocalModelError('INVALID_RESPONSE', `Invalid Ollama metric: ${field}.`);
      }
      result[target] = value / divisor;
    }
  }
  if (result.evalDurationMs && result.completionTokens !== undefined) {
    result.tokensPerSecond = result.completionTokens / (result.evalDurationMs / 1000);
  }
  return result;
}
