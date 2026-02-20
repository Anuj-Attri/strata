/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "electron"
/*!****************************************!*\
  !*** external "require(\"electron\")" ***!
  \****************************************/
(module) {

"use strict";
module.exports = require("require(\"electron\")");

/***/ },

/***/ "child_process"
/*!********************************!*\
  !*** external "child_process" ***!
  \********************************/
(module) {

"use strict";
module.exports = require("child_process");

/***/ },

/***/ "fs"
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
(module) {

"use strict";
module.exports = require("fs");

/***/ },

/***/ "path"
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
(module) {

"use strict";
module.exports = require("path");

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Check if module exists (development only)
/******/ 		if (__webpack_modules__[moduleId] === undefined) {
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!*********************!*\
  !*** ./src/main.js ***!
  \*********************/
const path = __webpack_require__(/*! path */ "path");
const { app, BrowserWindow, ipcMain, dialog, clipboard } = __webpack_require__(/*! electron */ "electron");
const { spawn } = __webpack_require__(/*! child_process */ "child_process");

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
    const fs = __webpack_require__(/*! fs */ "fs");
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
  const preloadPath = '/home/anuj-attri/Codes/Strata/strata/frontend/.webpack/renderer/main_window/preload.js' || 0;
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
    'http://localhost:3000/main_window/index.html' ||
    0 ||
    0;
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

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=main.bundle.js.map