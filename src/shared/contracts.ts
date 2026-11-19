import type {
  PersonaDraft,
  PersonaSnapshot,
  FriendMemoryStore,
  ConversationHistory,
  EvaluationScenario,
} from '../../packages/persona-core/src/index.ts';
import type { ChatMetrics, LocalModel } from '../../packages/local-model/types.ts';

export interface ModelProfile {
  model: string;
  digest: string;
  temperature: number;
  numCtx: number;
  numPredict: number;
  seed: number;
}
export interface CharacterBundle {
  format: 'orange-cat-character';
  schemaVersion: 1;
  persona: PersonaSnapshot;
  modelProfile: ModelProfile;
}
export interface FriendProfile {
  id: string;
  name: string;
  memory: FriendMemoryStore;
  history: ConversationHistory;
}
export interface EvaluationRecord {
  id: string;
  friendId: string;
  personaRevision: number;
  model: string;
  digest: string;
  mode: 'persona' | 'generic';
  input: string;
  output: string;
  createdAt: string;
  metrics: ChatMetrics;
  rating?: 'like-me' | 'needs-work';
  correction?: string;
  selectedMemoryIds: readonly string[];
  omittedHistoryTurns: number;
  omittedMemoryCount: number;
}
export interface LabState {
  draft: PersonaDraft;
  published: CharacterBundle | null;
  friends: FriendProfile[];
  records: EvaluationRecord[];
  scenarios: readonly EvaluationScenario[];
  storagePath: string;
}
export interface PublishInput {
  model: string;
  temperature: number;
  numCtx: number;
  numPredict: number;
  seed: number;
}
export interface ChatInput {
  friendId: string;
  input: string;
  mode: 'persona' | 'generic';
}
export interface MemoryInput {
  friendId: string;
  id?: string;
  text: string;
}
export interface LabApi {
  getState(): Promise<LabState>;
  saveDraft(draft: PersonaDraft): Promise<LabState>;
  listModels(): Promise<LocalModel[]>;
  publish(input: PublishInput): Promise<LabState>;
  addFriend(name: string): Promise<LabState>;
  chat(input: ChatInput): Promise<LabState>;
  cancel(): Promise<void>;
  saveMemory(input: MemoryInput): Promise<LabState>;
  deleteMemory(friendId: string, memoryId: string): Promise<LabState>;
  clearConversation(friendId: string): Promise<LabState>;
  rate(recordId: string, rating: 'like-me' | 'needs-work'): Promise<LabState>;
  correct(recordId: string, text: string): Promise<LabState>;
  exportCharacter(): Promise<string | null>;
  importCharacter(): Promise<LabState | null>;
  exportEvaluation(): Promise<string | null>;
}
