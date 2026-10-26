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
  onSession(callback) {
    const listener = (_event, session) => callback(session);
    ipcRenderer.on("session", listener);
    return () => ipcRenderer.removeListener("session", listener);
  },
  sendInput(event) {
    ipcRenderer.send("input", event);
  },
  retrySession() {
    ipcRenderer.send("retry-session");
  },
  closeSession() {
    ipcRenderer.send("close-session");
  },
  saveQualityReport(report) {
    return ipcRenderer.invoke("save-quality-report", report);
  }
});
