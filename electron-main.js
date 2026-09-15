const path = require("node:path");
const { app, BrowserWindow, desktopCapturer, session } = require("electron");

const port = Number(process.env.FINE_REMOTE_SERVER_PORT || 3030);

app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const sources = await desktopCapturer.getSources({ types: ["screen"] });
    callback({ video: sources[0] });
  });
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: "#090d14",
    title: "Fine Remote",
    webPreferences: {
      preload: path.join(__dirname, "electron-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.loadURL(`http://127.0.0.1:${port}`);
});

app.on("window-all-closed", () => app.quit());
