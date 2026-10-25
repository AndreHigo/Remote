const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("remotoOperator", {
  onFrame(callback) {
    const listener = (_event, frame) => callback(frame);
    ipcRenderer.on("video-frame", listener);
    return () => ipcRenderer.removeListener("video-frame", listener);
  },
  onStatus(callback) {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("status", listener);
    return () => ipcRenderer.removeListener("status", listener);
  },
  onMetrics(callback) {
    const listener = (_event, metrics) => callback(metrics);
    ipcRenderer.on("metrics", listener);
    return () => ipcRenderer.removeListener("metrics", listener);
  },
  sendInput(event) {
    ipcRenderer.send("input", event);
  },
  closeSession() {
    ipcRenderer.send("close-session");
  }
});
