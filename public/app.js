const peers = [
  { name: "Design Studio", id: "ds-6f2a-e91c", host: "DESIGN-MAC-04", os: "macOS Sonoma 14.5", connected: "2 hours, 14 min", time: "10:42 AM", zone: "GMT−7" },
  { name: "Build Server", id: "bs-18cc-319a", host: "CI-BUILD-07", os: "Ubuntu 24.04 LTS", connected: "6 days, 8 hours", time: "5:42 PM", zone: "GMT" },
  { name: "Office Workstation", id: "ow-b390-a201", host: "OFFICE-PC-12", os: "Windows 11 Pro 24H2", connected: "38 min", time: "12:42 PM", zone: "GMT−5" },
];

const peerList = document.querySelector("#peer-list");
let selected = 0;

function drawPeers() {
  peerList.innerHTML = peers.map((peer, index) => `
    <button class="peer ${index === selected ? "active" : ""}" data-index="${index}">
      <span class="device-icon">▣</span>
      <span class="peer-copy"><strong>${peer.name}</strong><small>${peer.os.split(" ").slice(0, 2).join(" ")} · Online</small></span>
      <span class="online-dot"></span>
    </button>`).join("");
}

function selectPeer(index) {
  selected = index;
  const peer = peers[index];
  document.querySelector("#detail-name").textContent = peer.name;
  document.querySelector("#detail-id").textContent = `Peer ID · ${peer.id}`;
  document.querySelector("#detail-host").textContent = peer.host;
  document.querySelector("#detail-os").textContent = peer.os;
  document.querySelector("#detail-connected").textContent = peer.connected;
  document.querySelector("#detail-time").innerHTML = `${peer.time} <em>${peer.zone}</em>`;
  document.querySelector("#request-name").textContent = peer.name;
  drawPeers();
}

peerList.addEventListener("click", (event) => {
  const item = event.target.closest(".peer");
  if (item) selectPeer(Number(item.dataset.index));
});

const serverModal = document.querySelector("#server-modal");
document.querySelector("#server-connect").addEventListener("click", () => serverModal.classList.remove("open"));
document.querySelector("#close-server").addEventListener("click", () => serverModal.classList.remove("open"));
document.querySelector("#change-server").addEventListener("click", () => serverModal.classList.add("open"));

const requestModal = document.querySelector("#request-modal");
document.querySelector("#connect-button").addEventListener("click", () => requestModal.classList.add("open"));
document.querySelector("#cancel-request").addEventListener("click", () => requestModal.classList.remove("open"));

drawPeers();
