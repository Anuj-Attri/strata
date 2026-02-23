const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog, clipboard, session, shell } = require('electron');
const { spawn, execSync, spawnSync } = require('child_process');

let mainWindow = null;
let backendProcess = null;

const logPath = path.join(app.getPath('userData'), 'strata-startup.log');
const logStream = fs.createWriteStream(logPath, { flags: 'a' });
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  logStream.write(line);
  console.log(msg);
}

function getPythonPath() {
  const candidates = process.platform === 'win32'
    ? ['python', 'python3', 'py']
    : ['python3', 'python'];

  for (const candidate of candidates) {
    try {
      const version = execSync(`${candidate} --version 2>&1`).toString();
      if (version.includes('3.')) return candidate;
    } catch (e) {}
  }
  return null;
}

function getBackendDir() {
  if (app.isPackaged) {
    return path.join(path.dirname(app.getAppPath()), 'backend');
  }
  return path.join(__dirname, '../../backend');
}

function showPythonMissingDialog(mainWindow) {
  dialog.showMessageBox({
    type: 'error',
    title: 'Python Not Found',
    message: 'Strata requires Python 3.x to run the backend.',
    detail: 'Please install Python 3.11 from python.org and relaunch Strata.',
    buttons: ['Download Python', 'Cancel'],
    defaultId: 0
  }).then(({ response }) => {
    if (response === 0) shell.openExternal('https://www.python.org/downloads/');
    mainWindow.show();
  });
}

function startBackend(mainWindow) {
  const python = getPythonPath();
  const backendDir = getBackendDir();
  const mainPy = path.join(backendDir, 'main.py');

  log(`Python: ${python}`);
  log(`Backend dir: ${backendDir}`);
  log(`main.py exists: ${fs.existsSync(mainPy)}`);

  if (!python) {
    showPythonMissingDialog(mainWindow);
    return;
  }

  if (app.isPackaged) {
    const reqFile = path.join(backendDir, 'requirements.txt');
    log('Installing backend dependencies...');
    const result = spawnSync(python, [
      '-m', 'pip', 'install',
      '-r', reqFile,
      '--prefer-binary',
      '--quiet',
      '--disable-pip-version-check'
    ], {
      timeout: 300000,
      maxBuffer: 100 * 1024 * 1024,
      encoding: 'utf8'
    });
    if (result.status !== 0) {
      log(`pip install failed: ${result.stderr}`);
    } else {
      log('Dependencies installed successfully');
    }
  }

  backendProcess = spawn(python, [
    '-m', 'uvicorn', 'backend.main:app',
    '--port', '8000',
    '--log-level', 'info'
  ], {
    cwd: path.dirname(backendDir),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  backendProcess.stdout.on('data', (data) => {
    const out = data.toString();
    log(`[backend] ${out}`);
    if (out.includes('Application startup complete') || out.includes('Strata backend ready')) {
      mainWindow.show();
    }
  });

  backendProcess.stderr.on('data', (data) => {
    log(`[backend error] ${data.toString()}`);
  });

  backendProcess.on('error', (err) => {
    log(`[backend spawn error] ${err.message}`);
    mainWindow.show();
  });

  backendProcess.on('exit', (code, signal) => {
    backendProcess = null;
  });

  setTimeout(() => mainWindow.show(), 20000);
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
  createWindow();
  startBackend(mainWindow);

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' data: blob:; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data: blob:; connect-src 'self' http://127.0.0.1:8000 ws://127.0.0.1:8000 https://fonts.gstatic.com; img-src 'self' data: blob:;"
        ]
      }
    });
  });

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
