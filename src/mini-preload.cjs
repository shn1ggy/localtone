// Preload for the detached mini player window. It only receives a mirror of the
// main window's player and sends back clicks and keys; it has no other access.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('localtoneMini', {
  onSync: (callback) => {
    ipcRenderer.on('mini-sync', (_event, payload) => callback(payload));
  },
  input: (input) => ipcRenderer.send('mini-input', input),
});
// Main asks for confirmation that the latest mirror is on screen before it swaps
// windows: wait for artwork to decode, then for two frames.
ipcRenderer.on('paint-probe', async (_event, id) => {
  const images = [...document.images].filter((img) => img.src && img.decode);
  await Promise.race([
    Promise.allSettled(images.map((img) => img.decode())),
    new Promise((resolve) => setTimeout(resolve, 250)),
  ]);
  requestAnimationFrame(() => requestAnimationFrame(() => ipcRenderer.send('paint-ack', id)));
});
