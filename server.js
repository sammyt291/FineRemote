const path = require("node:path");
const express = require("express");
const { ExpressPeerServer } = require("peer");

const app = express();
const port = Number(process.env.PORT || 3030);
const httpServer = app.listen(port, () => {
  console.log(`Fine Remote is available at http://localhost:${port}`);
});

const peerServer = ExpressPeerServer(httpServer, {
  path: "/",
  allow_discovery: true,
  proxied: process.env.NODE_ENV === "production",
});

app.use("/peerjs", peerServer);
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});
