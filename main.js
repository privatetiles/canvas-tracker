const { app, BrowserWindow } = require('electron');
const server = require('./proxy.js');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 860,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Canvas Tracker',
    show: false,
  });

  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());

  const load = () => win.loadURL(`http://localhost:${server.address().port}`);
  if (server.listening) load();
  else server.once('listening', load);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
