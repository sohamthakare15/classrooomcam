/**
 * Electron Main Process for SmartClassroom AI Attendance System.
 * Manages window lifecycle, IPC bridges, and robust Python backend supervision.
 */

// Defensive self-healing: if invoked under ELECTRON_RUN_AS_NODE or pure node, re-spawn electron properly
const electron = require('electron');
if (typeof electron === 'string') {
  const { spawn } = require('child_process');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electron, [__filename, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env
  });
  child.on('exit', (code) => process.exit(code || 0));
  return;
}

const { app, BrowserWindow, ipcMain, dialog, Notification } = electron;
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const http = require('http');

let mainWindow = null;
let pythonProcess = null;
const BACKEND_PORT = 8000;
const FRONTEND_DEV_PORT = 5173;

/**
 * Checks if a local HTTP endpoint responds with HTTP 200.
 */
function checkEndpoint(url, timeoutMs = 800) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Polls FastAPI backend until healthy or max attempts reached.
 */
async function waitForBackendHealthy(maxRetries = 25, intervalMs = 500) {
  const healthUrl = `http://127.0.0.1:${BACKEND_PORT}/health`;
  for (let i = 0; i < maxRetries; i++) {
    const isHealthy = await checkEndpoint(healthUrl);
    if (isHealthy) {
      console.log(`[Electron] Python backend confirmed healthy on attempt ${i + 1}.`);
      return true;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Starts Python backend if not already listening.
 */
async function ensureBackendRunning() {
  const alreadyRunning = await checkEndpoint(`http://127.0.0.1:${BACKEND_PORT}/health`);
  if (alreadyRunning) {
    console.log('[Electron] Python AI Backend is already running on port 8000.');
    return true;
  }

  console.log('[Electron] Spawning local Python AI Backend on port 8000...');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const rootDir = path.join(__dirname, '..', '..');

  pythonProcess = spawn(pythonCmd, ['-m', 'ai_engine.api.main'], {
    cwd: rootDir,
    shell: true,
    stdio: 'inherit'
  });

  pythonProcess.on('error', (err) => {
    console.error('[Electron] Error spawning Python backend:', err);
  });

  pythonProcess.on('exit', (code, signal) => {
    console.log(`[Electron] Python backend process exited (code: ${code}, signal: ${signal})`);
    pythonProcess = null;
  });

  // Wait for health check
  const isHealthy = await waitForBackendHealthy(30, 500);
  if (!isHealthy) {
    console.error('[Electron] Timed out waiting for Python backend to respond on port 8000.');
    dialog.showErrorBox(
      'Backend Initialization Timeout',
      'The Python AI Backend failed to respond on http://127.0.0.1:8000 within 15 seconds.\n\nPlease ensure Python 3.10+ and required packages are installed, or run python -m ai_engine.api.main in a terminal to inspect logs.'
    );
    return false;
  }
  return true;
}

/**
 * Creates and loads main desktop application window.
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1080,
    minHeight: 720,
    title: 'SmartClassroom AI Attendance System',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  // Check if Vite dev server is running on 5173
  const isDevServerRunning = await checkEndpoint(`http://localhost:${FRONTEND_DEV_PORT}/`);
  const distPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');

  if (isDevServerRunning) {
    console.log(`[Electron] Connecting to live Vite dev server at http://localhost:${FRONTEND_DEV_PORT}`);
    mainWindow.loadURL(`http://localhost:${FRONTEND_DEV_PORT}`);
  } else if (fs.existsSync(distPath)) {
    console.log(`[Electron] Loading packaged frontend from ${distPath}`);
    mainWindow.loadFile(distPath);
  } else {
    console.error('[Electron] Frontend dist/index.html not found and dev server not running.');
    dialog.showErrorBox(
      'Frontend Assets Missing',
      'Could not find desktop/frontend/dist/index.html and no Vite server was detected on http://localhost:5173.\n\nPlease run "npm --prefix desktop/frontend run build" before launching.'
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'avi', 'mkv', 'mov'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result.filePaths[0] || null;
});

ipcMain.on('notify:show', (event, { title, body }) => {
  if (Notification && Notification.isSupported && Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

// App Lifecycle
app.whenReady().then(async () => {
  await ensureBackendRunning();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function cleanupChildProcesses() {
  if (pythonProcess && pythonProcess.pid) {
    console.log('[Electron] Terminating Python child process on shutdown...');
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${pythonProcess.pid} /f /t`);
      } else {
        pythonProcess.kill();
      }
    } catch (_) {}
    pythonProcess = null;
  }
}

app.on('will-quit', cleanupChildProcesses);
process.on('SIGINT', () => {
  cleanupChildProcesses();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanupChildProcesses();
  process.exit(0);
});
