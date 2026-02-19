const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const { spawn } = require('child_process');

let mainWindow = null;
let backendProcess = null;
let windowShown = false;

function getBackendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'strata_backend');
  }
  return path.join(__dirname, '../../backend/dist/strata_backend');
}

function showWindowIfReady() {
  if (windowShown || !mainWindow || mainWindow.isDestroyed()) return;
  windowShown = true;
  mainWindow.show();
}

function startBackend() {
  if (app.isPackaged) {
    const backendPath = getBackendPath();
    backendProcess = spawn(backendPath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });
  } else {
    const repoRoot = path.join(__dirname, '../../..');
    const fs = require('fs');
    const venvUvicorn = path.join(repoRoot, '.venv', 'bin', 'uvicorn');
    const uvicornCmd = fs.existsSync(venvUvicorn) ? venvUvicorn : 'uvicorn';
    backendProcess = spawn(uvicornCmd, ['backend.main:app', '--host', '127.0.0.1', '--port', '8000'], {
      cwd: repoRoot,
      env: { ...process.env },
      shell: uvicornCmd === 'uvicorn',
    });
  }

  let buffer = '';
  backendProcess.stdout.setEncoding('utf8');
  backendProcess.stdout.on('data', (data) => {
    const line = data.toString();
    console.log('[backend]', line);
    buffer += line;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const l of lines) {
      if (l.includes('Strata backend ready') && !windowShown) {
        showWindowIfReady();
      }
    }
  });

  backendProcess.stderr.setEncoding('utf8');
  backendProcess.stderr.on('data', (data) => {
    console.error('[backend err]', data.toString());
  });

  backendProcess.on('error', (err) => {
    console.error('Backend spawn error:', err);
  });

  backendProcess.on('exit', (code, signal) => {
    backendProcess = null;
  });

  if (!app.isPackaged) {
    setTimeout(() => {
      if (!windowShown && mainWindow && !mainWindow.isDestroyed()) {
        showWindowIfReady();
      }
    }, 10000);
  }
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
