const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const { spawn } = require('child_process');

let mainWindow = null;
let backendProcess = null;

function getBackendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'strata_backend');
  }
  return path.join(__dirname, '../../backend/dist/strata_backend');
}

function startBackend() {
  const backendPath = getBackendPath();
  backendProcess = spawn(backendPath, [], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  let buffer = '';
  backendProcess.stdout.setEncoding('utf8');
  backendProcess.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.includes('Strata backend ready')) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
        }
      }
    }
  });

  backendProcess.stderr.setEncoding('utf8');
  backendProcess.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  backendProcess.on('error', (err) => {
    console.error('Backend spawn error:', err);
  });

  backendProcess.on('exit', (code, signal) => {
    backendProcess = null;
  });
}

function createWindow() {
  const preloadPath = process.env.MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY || path.join(__dirname, 'preload.js');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  const loadUrl =
    process.env.MAIN_WINDOW_WEBPACK_ENTRY ||
    process.env.ELECTRON_DEV_URL ||
    `file://${path.join(__dirname, '../index.html')}`;
  mainWindow.loadURL(loadUrl).catch((err) => console.error(err));
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

ipcMain.handle('dialog:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Models', extensions: ['pt', 'pth', 'onnx'] }],
  });
  return result;
});

ipcMain.handle('dialog:save', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Text', extensions: ['txt'] }],
  });
  return result;
});

ipcMain.handle('clipboard:write', async (_event, text) => {
  clipboard.writeText(text);
});
