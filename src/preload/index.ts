import { contextBridge, ipcRenderer } from 'electron';
import type { LabApi } from '../shared/contracts.ts';

// Narrow, named operations only: the renderer never receives arbitrary IPC or file access.
const invoke = (method: keyof LabApi, ...args: unknown[]) =>
  ipcRenderer.invoke(`orange-cat:${method}`, ...args);
const api: LabApi = {
  getState: () => invoke('getState'),
  saveDraft: (draft) => invoke('saveDraft', draft),
  listModels: () => invoke('listModels'),
  publish: (input) => invoke('publish', input),
  addFriend: (name) => invoke('addFriend', name),
  chat: (input) => invoke('chat', input),
  cancel: () => invoke('cancel'),
  saveMemory: (input) => invoke('saveMemory', input),
  deleteMemory: (friendId, id) => invoke('deleteMemory', friendId, id),
  clearConversation: (friendId) => invoke('clearConversation', friendId),
  rate: (id, rating) => invoke('rate', id, rating),
  correct: (id, text) => invoke('correct', id, text),
  exportCharacter: () => invoke('exportCharacter'),
  importCharacter: () => invoke('importCharacter'),
  exportEvaluation: () => invoke('exportEvaluation'),
};
contextBridge.exposeInMainWorld('orangeCat', api);
