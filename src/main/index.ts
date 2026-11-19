import { app, BrowserWindow, dialog, ipcMain, protocol, session } from 'electron';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve, relative, extname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DocumentStore } from './store.ts';
import { LabService } from './service.ts';
import { serializeCharacterBundle } from './bundle.ts';
import { createLocalModelClient } from '../../packages/local-model/index.ts';
import type { LabApi } from '../shared/contracts.ts';

protocol.registerSchemesAsPrivileged([
  { scheme: 'pet', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
const rendererRoot = fileURLToPath(new URL('../renderer/', import.meta.url));
const devOrigin =
  !app.isPackaged && process.env.ORANGE_CAT_DEV_URL === 'http://127.0.0.1:5173'
    ? process.env.ORANGE_CAT_DEV_URL
    : null;
let window: BrowserWindow | null = null;
let service: LabService;
let store: DocumentStore;

function allowedPage(raw: string): boolean {
  try {
    const url = new URL(raw);
    return devOrigin ? url.origin === devOrigin : url.protocol === 'pet:' && url.host === 'app';
  } catch {
    return false;
  }
}

async function openWindow() {
  window = new BrowserWindow({
    width: 1240,
    height: 850,
    minWidth: 960,
    minHeight: 680,
    title: '橘猫 · 离线验证工作台',
    backgroundColor: '#f5f3ee',
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.cjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!allowedPage(url)) event.preventDefault();
  });
  window.on('closed', () => {
    service.cancel();
    window = null;
  });
  await window.loadURL(devOrigin ?? 'pet://app/index.html');
}

async function saveJson(defaultPath: string, contents: string): Promise<string | null> {
  if (!window) return null;
  const result = await dialog.showSaveDialog(window, {
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return null;
  await writeFile(result.filePath, contents, { encoding: 'utf8', mode: 0o600 });
  return result.filePath;
}

// Let Electron finish loading this ES module before waiting for the ready event.
async function startWorkbench() {
  app.setAppUserModelId('local.orange-cat.workbench');
  const dataDir = process.env.ORANGE_CAT_DATA_DIR
    ? resolve(process.env.ORANGE_CAT_DATA_DIR)
    : app.getPath('userData');
  await mkdir(dataDir, { recursive: true });
  const databasePath = join(dataDir, 'orange-cat-lab.sqlite');
  store = new DocumentStore(databasePath);
  service = new LabService(store, createLocalModelClient(), databasePath);

  protocol.handle('pet', async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('', { status: 403 });
    const file = resolve(rendererRoot, `.${decodeURIComponent(url.pathname)}`);
    const rel = relative(rendererRoot, file);
    if (rel.startsWith('..') || isAbsolute(rel)) return new Response('', { status: 403 });
    const types: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
    };
    try {
      return new Response(await readFile(file), {
        headers: { 'content-type': types[extname(file)] ?? 'application/octet-stream' },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed =
      allowedPage(details.url) ||
      details.url.startsWith('data:') ||
      (devOrigin !== null && details.url.startsWith('ws://127.0.0.1:5173/'));
    callback({ cancel: !allowed });
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) =>
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${devOrigin ? 'ws://127.0.0.1:5173' : ''}; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none';`,
        ],
      },
    }),
  );

  const handlers: LabApi = {
    getState: async () => service.getState(),
    saveDraft: async (draft) => service.saveDraft(draft),
    listModels: () => service.listModels(),
    publish: (input) => service.publish(input),
    addFriend: async (name) => service.addFriend(name),
    chat: (input) => service.chat(input),
    cancel: async () => service.cancel(),
    saveMemory: async (input) => service.saveMemory(input),
    deleteMemory: async (friendId, id) => service.deleteMemory(friendId, id),
    clearConversation: async (friendId) => service.clearConversation(friendId),
    rate: async (id, rating) => service.rate(id, rating),
    correct: async (id, text) => service.correct(id, text),
    exportCharacter: async () => {
      const bundle = service.getState().published;
      if (!bundle) throw new Error('请先发布一个测试版本。');
      return saveJson(
        `orange-cat-character-v${bundle.persona.revision}.json`,
        serializeCharacterBundle(bundle),
      );
    },
    importCharacter: async () => {
      if (!window) return null;
      const result = await dialog.showOpenDialog(window, {
        properties: ['openFile'],
        filters: [{ name: '橘猫角色文件', extensions: ['json'] }],
      });
      const filename = result.filePaths[0];
      if (result.canceled || !filename) return null;
      if ((await stat(filename)).size > 256_000)
        throw new Error('角色文件超过 256 KB；请确认选择的是角色导出文件。');
      return service.importCharacter(JSON.parse(await readFile(filename, 'utf8')));
    },
    exportEvaluation: async () =>
      saveJson(
        'orange-cat-evaluation-private.json',
        JSON.stringify(
          {
            format: 'orange-cat-private-evaluation',
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            records: service.getState().records,
          },
          null,
          2,
        ),
      ),
  };

  for (const [name, handler] of Object.entries(handlers)) {
    ipcMain.handle(`orange-cat:${name}`, async (event, ...args: unknown[]) => {
      if (
        !window ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        !allowedPage(event.senderFrame.url)
      )
        throw new Error('拒绝未知页面请求。');
      try {
        return await (handler as (...args: unknown[]) => unknown)(...args);
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : '操作失败，请重试。');
      }
    });
  }
  app.on('activate', () => {
    if (!window) void openWindow();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', () => {
    service.cancel();
  });
  app.on('will-quit', () => {
    store.close();
  });
  await openWindow();
}

void app.whenReady().then(startWorkbench).catch((error: unknown) => {
  console.error('橘猫工作台启动失败', error);
  app.exit(1);
});
