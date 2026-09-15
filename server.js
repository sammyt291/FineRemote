const path = require("node:path");
const { spawn } = require("node:child_process");
const express = require("express");
const cors = require("cors");
const { ExpressPeerServer } = require("peer");
const { getFfmpegStatus } = require("./src/ffmpeg");

function createFineRemoteServer({ port = Number(process.env.PORT || 3030) } = {}) {
  const app = express();
  const connected = new Map();
  const presence = new Map();
  const startedAt = Date.now();
  const httpServer = app.listen(port, () => {
    const address = httpServer.address();
    const actualPort = typeof address === "object" ? address.port : port;
    console.log(`Fine Remote server is available at http://localhost:${actualPort}`);
  });

  const peerServer = ExpressPeerServer(httpServer, {
    path: "/",
    allow_discovery: true,
    proxied: process.env.NODE_ENV === "production",
  });

  peerServer.on("connection", (client) => {
    connected.set(client.getId(), Date.now());
  });
  peerServer.on("disconnect", (client) => {
    connected.delete(client.getId());
    presence.delete(client.getId());
  });

  app.use(cors());
  app.use(express.json({ limit: "16kb" }));
  app.use("/peerjs", peerServer);
  app.use("/vendor/peerjs", express.static(path.join(__dirname, "node_modules", "peerjs", "dist")));

  app.get("/api/status", (_request, response) => {
    response.json({
      status: "ok",
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      peerCount: connected.size,
      ffmpeg: getFfmpegStatus(),
    });
  });

  app.get("/api/peers", (request, response) => {
    const ownId = String(request.query.exclude || "");
    const now = Date.now();
    const peers = [...connected].filter(([id]) => id !== ownId).map(([id, connectedAt]) => {
      const details = presence.get(id) || {};
      return {
        id,
        name: details.name || `Peer ${id.slice(0, 8)}`,
        host: details.host || "Unknown host",
        os: details.os || "Unknown operating system",
        timezone: details.timezone || "UTC",
        connectedAt,
        lastSeen: details.lastSeen || connectedAt,
      };
    });
    response.json({ peers, timestamp: now });
  });

  app.post("/api/presence", (request, response) => {
    const id = clean(request.body.id, 128);
    if (!id || !connected.has(id)) return response.status(409).json({ error: "Peer is not connected" });
    presence.set(id, {
      name: clean(request.body.name, 80),
      host: clean(request.body.host, 128),
      os: clean(request.body.os, 128),
      timezone: clean(request.body.timezone, 64),
      lastSeen: Date.now(),
    });
    response.status(204).end();
  });

  app.use(express.static(path.join(__dirname, "public")));
  app.get("/health", (_request, response) => response.json({ status: "ok" }));

  return { app, httpServer, peerServer };
}

function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

if (require.main === module) {
  const server = createFineRemoteServer();
  if (process.argv.includes("--client")) {
    server.httpServer.once("listening", () => {
      const address = server.httpServer.address();
      const port = typeof address === "object" ? address.port : Number(process.env.PORT || 3030);
      const electron = require("electron");
      const child = spawn(electron, [path.join(__dirname, "electron-main.js"), `--server-port=${port}`], {
        stdio: "inherit",
        env: { ...process.env, FINE_REMOTE_SERVER_PORT: String(port) },
      });
      child.once("exit", () => server.httpServer.close());
    });
  }
}

module.exports = { createFineRemoteServer };
