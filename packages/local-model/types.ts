/** Only text messages are accepted by the offline M0 client. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatSettings {
  /** A finite number between 0 and 2. Default: 0.7. */
  temperature?: number;
  /** Integer context budget, 256–32768. Default: 4096. */
  numCtx?: number;
  /** Integer maximum generated tokens, 1–4096. Default: 384. */
  numPredict?: number;
  /** Optional reproducibility hint; an integer from 0 through 2147483647. */
  seed?: number;
  /** Entire preflight + generation deadline, 1–600000 ms. */
  timeoutMs?: number;
  /** Pin a published persona to the exact local Ollama manifest digest. */
  expectedDigest?: string;
}

export interface LocalModel {
  name: string;
  /** SHA-256 manifest digest returned by the local /api/tags inventory. */
  digest: string;
  sizeBytes: number;
  architecture: string;
  parameterSize?: string;
  quantization?: string;
  contextLength?: number;
}

export interface LocalModelHealth {
  ok: true;
  version: string;
}

export interface ChatMetrics {
  /** Client-observed preflight + generation time. */
  wallDurationMs: number;
  /** Ollama reports durations in ns; the client converts them to ms. */
  totalDurationMs?: number;
  loadDurationMs?: number;
  promptEvalDurationMs?: number;
  evalDurationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  tokensPerSecond?: number;
}

export interface ChatResult {
  model: string;
  digest: string;
  content: string;
  metrics: ChatMetrics;
  createdAt?: string;
  doneReason?: string;
}

export type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface LocalModelClientOptions {
  /** Dependency injection for tests. Production should use Node's built-in fetch. */
  fetchImpl?: FetchImplementation;
  /** Entire operation deadline. Default: 120000 ms; maximum: 600000 ms. */
  timeoutMs?: number;
  /** Per-response byte cap. Default: 2097152; maximum: 8388608. */
  maxResponseBytes?: number;
}

export interface LocalModelClient {
  health(signal?: AbortSignal): Promise<LocalModelHealth>;
  /** Returns only models with positive local GGUF evidence from /api/show. */
  listModels(signal?: AbortSignal): Promise<LocalModel[]>;
  chat(
    messages: readonly ChatMessage[],
    model: string,
    settings?: ChatSettings,
    signal?: AbortSignal,
  ): Promise<ChatResult>;
}

export type LocalModelErrorCode =
  | 'INVALID_INPUT'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'HTTP_ERROR'
  | 'REDIRECT_BLOCKED'
  | 'INVALID_RESPONSE'
  | 'RESPONSE_TOO_LARGE'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_NOT_LOCAL'
  | 'DIGEST_MISMATCH';

export class LocalModelError extends Error {
  readonly code: LocalModelErrorCode;

  constructor(code: LocalModelErrorCode, message: string) {
    super(message);
    this.name = 'LocalModelError';
    this.code = code;
  }
}
