const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let phpProcess;

const LARAVEL_PORT = 8000;

function startPhpServer() {
  const phpPath =
    process.platform === 'win32'
      ? path.join(__dirname, 'php/windows/php.exe')
      : path.join(__dirname, `php/${process.platform}/php`);

  const laravelPublicPath = path.join(__dirname, '..', 'public');

  phpProcess = spawn(phpPath, [
    '-S',
    `127.0.0.1:${LARAVEL_PORT}`,
    '-t',
    laravelPublicPath,
  ]);

  phpProcess.stdout.on('data', data => {
    console.log(`PHP: ${data}`);
  });

  phpProcess.stderr.on('data', data => {
    console.error(`PHP ERROR: ${data}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${LARAVEL_PORT}`);
}

app.whenReady().then(() => {
  startPhpServer();

  // Give PHP time to boot
  setTimeout(createWindow, 1200);
});

app.on('before-quit', () => {
  if (phpProcess) phpProcess.kill();
});
