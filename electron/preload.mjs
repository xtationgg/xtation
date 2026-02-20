import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('hextechDesktop', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
});
