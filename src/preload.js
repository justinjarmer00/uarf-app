// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipc', {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, callback) => {
        const subscription = ipcRenderer.on(channel, (event, ...args) => callback(...args));
        return subscription;
    },
    invoke: (channel, data) => ipcRenderer.invoke(channel, data)  // Expose the invoke method
});