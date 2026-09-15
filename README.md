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

### NAT traversal and TURN

Fine Remote overrides PeerJS's built-in ICE server list because its legacy public TURN hostnames are no longer reliable. By default, clients use Google STUN for direct peer-to-peer connectivity. If either client is behind a restrictive or symmetric NAT, configure a TURN server on the signaling server before starting it:

```bash
export FINE_REMOTE_ICE_SERVERS='[
  {"urls":"stun:stun.l.google.com:19302"},
  {"urls":"turn:turn.example.com:3478","username":"fine-remote","credential":"replace-me"}
]'
npm start
```

The value must be a JSON array of WebRTC ICE server objects. It is returned to clients by `/api/config`, so use time-limited TURN credentials in production. TURN runs as a separate service (for example, coturn); the PeerJS server only provides signaling.

Port-forwarding the Fine Remote/PeerJS server only exposes signaling and discovery; it does not relay WebRTC traffic. Clients behind restrictive or symmetric NAT therefore require the TURN configuration above.

## Launch the desktop client

```bash
npm run client
# equivalent: npm start -- --client
```

The `--client` launch argument starts the signaling server and opens the status and connection interface in a dedicated Electron window. Plain `npm start` remains server-only for headless deployments.

Fine Remote uses `ffmpeg-static`, which downloads a platform-specific FFmpeg binary during `npm install`. At runtime it prefers `FFMPEG_PATH` when provided, then the downloaded binary, and finally a system `ffmpeg` executable. Its availability is reported live in the client status bar and `/api/status`.

## Production architecture outline

1. **Discovery and identity:** clients connect to the PeerJS server over TLS, publish a signed presence record (peer ID, display name, hostname, OS/version, connected timestamp, time-zone offset), and subscribe to presence changes. Authentication and authorization sit in front of discovery so peers only see approved devices.
2. **Consent:** the controller opens one standard PeerJS data connection with the request in its connection metadata. The host displays Allow/Deny as soon as that channel opens and replies on the same channel. Only an explicit, short-lived approval starts capture and input channels. Both parties can terminate at any time.
3. **Desktop capture:** a native client launches FFmpeg with platform capture (`ddagrab` on Windows, ScreenCaptureKit-compatible input on macOS, PipeWire on Linux). Encode with a hardware-backed, low-delay H.264 profile where possible and fall back to software `libx264` with `ultrafast`/`zerolatency` tuning.
4. **Media transport:** WebRTC carries video for congestion control, NAT traversal, encryption, and real-time packet-loss feedback. A TURN service is required when direct connectivity fails. PeerJS data channels carry control input and telemetry, not a custom raw video protocol.
5. **Adaptive quality:** offer 720p, 1080p, 1440p, native, and auto modes. A resolution change updates FFmpeg's scale stage and replaces the outbound WebRTC track without renegotiating the whole session. Auto mode uses RTT, loss, and available bitrate to step down before latency grows.
6. **Telemetry:** sample decoded/rendered frames, WebRTC inbound stats, and transport loss once per second. Display FPS, current data rate, and dropped packets in the persistent bottom bar.

The client uses live signaling presence, a PeerJS data connection for consent, and a PeerJS media call to send the approved desktop stream back to the requesting peer. In a browser, the sharing peer chooses a screen in the browser picker; the Electron client captures its primary screen after the user accepts the request.
