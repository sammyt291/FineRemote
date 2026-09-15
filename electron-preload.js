const os = require("node:os");
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("fineRemoteDesktop", {
  hostname: os.hostname(),
  platform: `${os.type()} ${os.release()}`,
});
