import { app, BrowserWindow } from 'electron';
import path from 'path';
import { setupDatabaseHandlers, initializeDatabase } from './database/database';

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // In development, load from the Vite dev server. vite-plugin-electron injects
  // the URL of the port Vite actually bound, which is not necessarily the one
  // configured: Vite falls back to the next free port when something else is
  // already holding it. Hardcoding the port here loads whatever happens to be
  // listening on it — including another project's dev server.
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    win.loadURL(devServerUrl);
    win.webContents.openDevTools();
    return;
  }

  if (process.env.NODE_ENV === 'development') {
    console.error(
      'VITE_DEV_SERVER_URL is not set — start the app with `npm start` so ' +
        'vite-plugin-electron can supply it. Falling back to the last build.'
    );
  }

  // In production, load the built files
  win.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(async () => {
  try {
    // Initialize database first
    await initializeDatabase();

    // Set up database handlers
    setupDatabaseHandlers();

    // Create window after database is ready
    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
