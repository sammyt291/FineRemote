# Fine Remote

Fine Remote is a product and interaction prototype for a low-latency, consent-based remote desktop tool. It has two parts:

- **Server:** a small Node.js process that mounts a PeerJS signaling server at `/peerjs` and serves the client shell.
- **Client:** a desktop-oriented interface for choosing a signaling server, discovering peers, inspecting device details, requesting consent, and monitoring stream health.

## Run the server

```bash
npm install
npm start
```

Open `http://localhost:3030`. The initial server prompt, peer selection, change-server flow, and connection-request flow are interactive.

Connected clients now register live presence with the signaling server. The peer list contains only currently connected PeerJS clients and is refreshed every two seconds.

## Launch the desktop client

```bash
npm run client
# equivalent: npm start -- --client
```

The `--client` launch argument starts the signaling server and opens the status and connection interface in a dedicated Electron window. Plain `npm start` remains server-only for headless deployments.

Fine Remote uses `ffmpeg-static`, which downloads a platform-specific FFmpeg binary during `npm install`. At runtime it prefers `FFMPEG_PATH` when provided, then the downloaded binary, and finally a system `ffmpeg` executable. Its availability is reported live in the client status bar and `/api/status`.

## Production architecture outline

1. **Discovery and identity:** clients connect to the PeerJS server over TLS, publish a signed presence record (peer ID, display name, hostname, OS/version, connected timestamp, time-zone offset), and subscribe to presence changes. Authentication and authorization sit in front of discovery so peers only see approved devices.
2. **Consent:** the controller opens a PeerJS data channel and sends a connection request. The host displays Allow/Deny locally. Only an explicit, short-lived approval starts capture and input channels. Both parties can terminate at any time.
3. **Desktop capture:** a native client launches FFmpeg with platform capture (`ddagrab` on Windows, ScreenCaptureKit-compatible input on macOS, PipeWire on Linux). Encode with a hardware-backed, low-delay H.264 profile where possible and fall back to software `libx264` with `ultrafast`/`zerolatency` tuning.
4. **Media transport:** WebRTC carries video for congestion control, NAT traversal, encryption, and real-time packet-loss feedback. A TURN service is required when direct connectivity fails. PeerJS data channels carry control input and telemetry, not a custom raw video protocol.
5. **Adaptive quality:** offer 720p, 1080p, 1440p, native, and auto modes. A resolution change updates FFmpeg's scale stage and replaces the outbound WebRTC track without renegotiating the whole session. Auto mode uses RTT, loss, and available bitrate to step down before latency grows.
6. **Telemetry:** sample decoded/rendered frames, WebRTC inbound stats, and transport loss once per second. Display FPS, current data rate, and dropped packets in the persistent bottom bar.

The current client uses live signaling presence and PeerJS data connections. Native capture and WebRTC media wiring remain future work.
