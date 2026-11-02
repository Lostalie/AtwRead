const { app, BrowserWindow, ipcMain, dialog, protocol, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { readDocument, resolveImage } = require('./files.cjs');
app.setName('AtwRead');
app.setPath('userData', path.join(app.getPath('appData'), 'AtwRead'));
if (!app.isPackaged && process.env.ATWREAD_TEST_USER_DATA) app.setPath('userData', process.env.ATWREAD_TEST_USER_DATA);
protocol.registerSchemesAsPrivileged([{ scheme: 'atw', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
let win;
let recent = [];
let imageRoots = new Map();
let initialPath = process.argv.slice(1).find(a => /\.(pdf|md|markdown)$/i.test(a) && path.isAbsolute(a));
let saveQueue = Promise.resolve();
const stateFile = () => path.join(app.getPath('userData'), 'recent.json');
async function localResponse(file) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.bmp': 'image/bmp', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
  return new Response(await fs.readFile(file), { headers: { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' } });
}
function errorMessage(error) {
  if (error.code === 'ENOENT') return '文件不存在或已被移动。';
  if (error.code === 'EACCES' || error.code === 'EPERM') return '没有权限读取这个文件。';
  return error.message || '无法打开文件。';
}
async function open(file) {
  try {
    const doc = await readDocument(file);
    const token = crypto.randomUUID();
    imageRoots.set(token, path.dirname(doc.path));
    while (imageRoots.size > 20) imageRoots.delete(imageRoots.keys().next().value);
    doc.baseUrl = `atw://image/${token}/`;
    recent = [{ path: doc.path, name: doc.name, type: doc.type }, ...recent.filter(x => x.path !== doc.path)].slice(0, 12);
    const serialized = JSON.stringify(recent);
    saveQueue = saveQueue.then(async () => {
      await fs.mkdir(app.getPath('userData'), { recursive: true });
      await fs.writeFile(stateFile(), serialized, 'utf8');
    }).catch(() => {});
    return { ok: true, document: doc, recent };
  } catch (error) { return { ok: false, error: errorMessage(error) }; }
}
function handle(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || !event.senderFrame.url.startsWith('atw://app/')) throw new Error('不受信任的请求。');
    return handler(...args);
  });
}
function createWindow() {
  win = new BrowserWindow({ width: 1280, height: 860, minWidth: 840, minHeight: 600,
    title: 'AtwRead', backgroundColor: '#f5f3ef', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !/^(atw:|data:|blob:|devtools:)/.test(details.url) }));
  win.loadURL('atw://app/index.html');
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_event, argv) => {
    const file = argv.find(a => /\.(pdf|md|markdown)$/i.test(a) && path.isAbsolute(a));
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); if (file) win.webContents.send('open-request', file); }
  });
  app.whenReady().then(async () => {
    try { recent = JSON.parse(await fs.readFile(stateFile(), 'utf8')).filter(x => typeof x.path === 'string' && typeof x.name === 'string' && ['md','pdf'].includes(x.type)).slice(0, 12); } catch { recent = []; }
    protocol.handle('atw', async request => {
      try {
        const url = new URL(request.url);
        if (url.host === 'app') {
          const root = path.resolve(__dirname, '../dist');
          const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
          const relative = path.relative(root, target);
          if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response('', { status: 403 });
          return await localResponse(target);
        }
        if (url.host === 'image') {
          const [, token, ...parts] = url.pathname.split('/');
          const root = imageRoots.get(token);
          if (!root) return new Response('', { status: 404 });
          const target = await resolveImage(root, decodeURIComponent(parts.join('/')));
          return await localResponse(target);
        }
      } catch { return new Response('', { status: 404 }); }
      return new Response('', { status: 404 });
    });
    handle('initialize', () => { const file = initialPath; initialPath = null; return { recent, file }; });
    handle('open-file', async file => {
      if (!file) {
        const result = await dialog.showOpenDialog(win, { title: '打开阅读文件', properties: ['openFile'], filters: [{ name: '阅读文档', extensions: ['pdf', 'md', 'markdown'] }] });
        if (result.canceled) return { canceled: true };
        file = result.filePaths[0];
      }
      return open(file);
    });
    Menu.setApplicationMenu(null);
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => app.quit());
}
