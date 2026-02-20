import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5176';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#0a0a0a',
    title: 'Hextech Client',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.setTitle('Hextech Client');

  // Keep desktop title stable instead of inheriting <title> from web page.
  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    if (mainWindow) mainWindow.setTitle('Hextech Client');
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(devUrl);
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_, permission, callback) => {
    if (permission === 'geolocation' || permission === 'notifications' || permission === 'media') {
      callback(true);
      return;
    }
    callback(false);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.handle('app:getVersion', () => app.getVersion());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
