const peerList = document.querySelector("#peer-list");
const serverModal = document.querySelector("#server-modal");
const requestModal = document.querySelector("#request-modal");
const connectButton = document.querySelector("#connect-button");
let peerClient;
let peers = [];
let selectedId = null;
let serverBase = window.location.origin;
let refreshTimer;
let presenceTimer;

function serverConfig(value) {
  const raw = value.trim() || window.location.host;
  const url = new URL(raw.includes("://") ? raw : `${window.location.protocol}//${raw}`);
  return {
    url,
    peerOptions: {
      host: url.hostname,
      port: url.port ? Number(url.port) : (url.protocol === "https:" ? 443 : 80),
      path: "/peerjs",
      secure: url.protocol === "https:",
    },
  };
}

async function connectToServer(address) {
  clearInterval(refreshTimer);
  clearInterval(presenceTimer);
  if (peerClient) peerClient.destroy();
  setConnectionState("Connecting…", false);

  const config = serverConfig(address);
  serverBase = config.url.origin;
  document.querySelector("#server-address").textContent = config.url.host;
  peerClient = new Peer(config.peerOptions);

  peerClient.on("open", async (id) => {
    serverModal.classList.remove("open");
    setConnectionState("Connected", true);
    document.querySelector("#own-peer-id").textContent = id;
    await publishPresence();
    await refreshPeers();
    refreshTimer = setInterval(refreshPeers, 2000);
    presenceTimer = setInterval(publishPresence, 15000);
  });
  peerClient.on("connection", acceptConnection);
  peerClient.on("disconnected", () => setConnectionState("Reconnecting…", false));
  peerClient.on("error", (error) => {
    setConnectionState("Connection error", false);
    document.querySelector("#server-error").textContent = error.message;
  });
}

function publishPresence() {
  if (!peerClient?.open) return;
  const desktop = window.fineRemoteDesktop;
  const payload = {
    id: peerClient.id,
    name: desktop?.hostname || `Browser on ${navigator.platform || "this device"}`,
    host: desktop?.hostname || window.location.hostname,
    os: desktop?.platform || navigator.userAgentData?.platform || navigator.platform || "Web browser",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  return fetch(`${serverBase}/api/presence`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}

async function refreshPeers() {
  if (!peerClient?.id) return;
  const started = performance.now();
  try {
    const [peerResponse, statusResponse] = await Promise.all([
      fetch(`${serverBase}/api/peers?exclude=${encodeURIComponent(peerClient.id)}`),
      fetch(`${serverBase}/api/status`),
    ]);
    if (!peerResponse.ok || !statusResponse.ok) throw new Error("Server returned an error");
    peers = (await peerResponse.json()).peers;
    const status = await statusResponse.json();
    document.querySelector("#latency").textContent = `${Math.round(performance.now() - started)} ms`;
    document.querySelector("#ffmpeg-state").textContent = status.ffmpeg.available ? "FFmpeg ready" : "FFmpeg unavailable";
    document.querySelector("#peer-count").textContent = peers.length;
    if (!peers.some((item) => item.id === selectedId)) selectedId = peers[0]?.id || null;
    drawPeers();
    showSelectedPeer();
  } catch (error) {
    setConnectionState("Server unavailable", false);
  }
}

function drawPeers() {
  peerList.replaceChildren();
  if (!peers.length) {
    const empty = document.createElement("p");
    empty.className = "empty-peers";
    empty.textContent = "No other peers are connected.";
    peerList.append(empty);
    return;
  }
  peers.forEach((peer) => {
    const button = document.createElement("button");
    button.className = `peer${peer.id === selectedId ? " active" : ""}`;
    button.dataset.id = peer.id;
    button.innerHTML = `<span class="device-icon">▣</span><span class="peer-copy"><strong></strong><small></small></span><span class="online-dot"></span>`;
    button.querySelector("strong").textContent = peer.name;
    button.querySelector("small").textContent = `${peer.os} · Online`;
    peerList.append(button);
  });
}

function showSelectedPeer() {
  const peer = peers.find((item) => item.id === selectedId);
  document.querySelector("#device-panel").classList.toggle("is-empty", !peer);
  document.querySelector("#empty-selection").hidden = Boolean(peer);
  document.querySelector("#device-details").hidden = !peer;
  if (!peer) return;
  document.querySelector("#detail-name").textContent = peer.name;
  document.querySelector("#detail-id").textContent = `Peer ID · ${peer.id}`;
  document.querySelector("#detail-host").textContent = peer.host;
  document.querySelector("#detail-os").textContent = peer.os;
  document.querySelector("#detail-connected").textContent = elapsed(peer.connectedAt);
  document.querySelector("#detail-time").textContent = localTime(peer.timezone);
  document.querySelector("#request-name").textContent = peer.name;
}

function requestConnection() {
  const remote = peers.find((item) => item.id === selectedId);
  if (!remote || !peerClient?.open) return;
  requestModal.classList.add("open");
  const connection = peerClient.connect(remote.id, { reliable: true });
  connection.on("open", () => connection.send({ type: "connection-request", from: peerClient.id }));
  connection.on("data", (message) => {
    if (message?.type === "connection-response") {
      document.querySelector("#request-title").textContent = message.accepted ? "Connection approved" : "Connection declined";
    }
  });
  connection.on("error", () => requestModal.classList.remove("open"));
}

function acceptConnection(connection) {
  connection.on("data", (message) => {
    if (message?.type !== "connection-request") return;
    const accepted = window.confirm(`Peer ${message.from} is requesting a connection. Allow it?`);
    connection.send({ type: "connection-response", accepted });
  });
}

function elapsed(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds} sec`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  return `${Math.floor(seconds / 3600)} hr ${Math.floor((seconds % 3600) / 60)} min`;
}

function localTime(timezone) {
  try { return new Intl.DateTimeFormat([], { timeStyle: "short", timeZone: timezone }).format(new Date()); }
  catch { return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
}

function setConnectionState(label, online) {
  document.querySelector("#connection-label").textContent = label;
  document.querySelector("#connection-pill").classList.toggle("offline", !online);
}

peerList.addEventListener("click", (event) => {
  const item = event.target.closest(".peer");
  if (item) { selectedId = item.dataset.id; drawPeers(); showSelectedPeer(); }
});
document.querySelector("#server-connect").addEventListener("click", () => connectToServer(document.querySelector("#server-input").value));
document.querySelector("#close-server").addEventListener("click", () => serverModal.classList.remove("open"));
document.querySelector("#change-server").addEventListener("click", () => serverModal.classList.add("open"));
connectButton.addEventListener("click", requestConnection);
document.querySelector("#cancel-request").addEventListener("click", () => requestModal.classList.remove("open"));

document.querySelector("#server-input").value = window.location.host;
connectToServer(window.location.host);
