'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopBridge', {
    retry: function () { ipcRenderer.send('desktop-retry'); }
});
