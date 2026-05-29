const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path  = require('path')
const { spawn } = require('child_process')
const http  = require('http')

// ── Paths ─────────────────────────────────────────────────────────────────────
const ROOT         = path.resolve(__dirname, '..', '..')
const BACKEND_DIR  = path.join(ROOT, 'app', 'backend')
const PYTHON_WIN   = path.join(ROOT, 'env', 'Scripts', 'python.exe')
const PYTHON_UNIX  = path.join(ROOT, 'env', 'bin', 'python')
const PYTHON_BIN   = process.platform === 'win32' ? PYTHON_WIN : PYTHON_UNIX
const BACKEND_PORT = 8000
// prod mode: packaged build OR AVSP_PROD env var (set by start-prod.bat)
const IS_PROD      = app.isPackaged || process.env.AVSP_PROD === '1'
const FRONTEND_URL = IS_PROD
  ? `http://127.0.0.1:${BACKEND_PORT}`
  : 'http://localhost:5173'

let mainWindow   = null
let backendProc  = null

// ── Backend lifecycle ─────────────────────────────────────────────────────────
function startBackend() {
  const python = require('fs').existsSync(PYTHON_BIN) ? PYTHON_BIN : 'python'
  backendProc = spawn(python, ['main.py'], {
    cwd: BACKEND_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  })

  backendProc.stdout.on('data', d => process.stdout.write(`[backend] ${d}`))
  backendProc.stderr.on('data', d => process.stderr.write(`[backend] ${d}`))
  backendProc.on('exit', (code) => {
    console.log(`[backend] exited with code ${code}`)
  })
}

function stopBackend() {
  if (backendProc && !backendProc.killed) {
    backendProc.kill('SIGTERM')
    backendProc = null
  }
}

// ── Wait for backend to be ready ──────────────────────────────────────────────
function waitForBackend(retries = 30, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      attempts++
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, res => {
        if (res.statusCode === 200) resolve()
        else tryAgain()
      })
      req.on('error', tryAgain)
      req.setTimeout(300, () => { req.destroy(); tryAgain() })
    }
    const tryAgain = () => {
      if (attempts >= retries) reject(new Error('Backend did not start'))
      else setTimeout(check, interval)
    }
    check()
  })
}

// ── Window ────────────────────────────────────────────────────────────────────
async function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1440,
    height: 900,
    minWidth:  1280,
    minHeight: 720,
    frame:    true,
    show:     false,
    backgroundColor: '#070b14',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload:           path.join(__dirname, 'preload.js'),
      nodeIntegration:   false,
      contextIsolation:  true,
      sandbox:           false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Inject API base URL
  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.executeJavaScript(
      `window.__APP_API__ = 'http://127.0.0.1:${BACKEND_PORT}';`
    )
  })

  await mainWindow.loadURL(FRONTEND_URL)
  mainWindow.on('closed', () => { mainWindow = null })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  startBackend()

  // Show a loading window while waiting
  mainWindow = new BrowserWindow({
    width: 400, height: 250,
    frame: false, resizable: false,
    backgroundColor: '#070b14',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  await mainWindow.loadURL(`data:text/html,
    <body style="background:#070b14;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px">
      <div style="font-size:18px;font-weight:600">AI Video Studio Pro</div>
      <div style="font-size:12px;opacity:.4">Starting backend…</div>
    </body>`)

  try {
    await waitForBackend()
  } catch (e) {
    console.error('Backend failed to start:', e.message)
  }

  const splash = mainWindow
  mainWindow = null
  await createWindow()
  if (splash && !splash.isDestroyed()) splash.destroy()
})

app.on('window-all-closed', () => {
  stopBackend()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => stopBackend())
app.on('activate', () => { if (!mainWindow) createWindow() })

// ── IPC: File / Folder picker ─────────────────────────────────────────────────
ipcMain.handle('pick-file', async (_, opts = {}) => {
  const filters = opts.type === 'audio'
    ? [{ name: 'Audio', extensions: ['mp3','aac','wav','flac','ogg','m4a'] }]
    : opts.type === 'image'
    ? [{ name: 'Images', extensions: ['jpg','jpeg','png','gif','webp','bmp'] }]
    : [
        { name: 'Video', extensions: ['mp4','mov','avi','mkv','webm','m4v','wmv','flv','ts','mts'] },
        { name: 'All Files', extensions: ['*'] },
      ]

  const result = await dialog.showOpenDialog(mainWindow, {
    title:       opts.title ?? 'Select file',
    filters,
    properties:  opts.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
  })
  if (result.canceled) return { cancelled: true, paths: [] }
  return { cancelled: false, paths: result.filePaths }
})

ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title:      'Select folder',
    properties: ['openDirectory'],
  })
  if (result.canceled) return { cancelled: true, path: '' }
  return { cancelled: false, path: result.filePaths[0] }
})

ipcMain.handle('save-file', async (_, opts = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title:       opts.title ?? 'Save file',
    defaultPath: opts.defaultName ?? 'export.mp4',
    filters:     opts.filters ?? [{ name: 'MP4 Video', extensions: ['mp4'] }],
  })
  if (result.canceled) return { cancelled: true, path: '' }
  return { cancelled: false, path: result.filePath }
})

ipcMain.handle('open-external', (_, url) => shell.openExternal(url))
ipcMain.handle('show-item-in-folder', (_, p) => shell.showItemInFolder(p))
