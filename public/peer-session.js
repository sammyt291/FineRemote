(function exposePeerSession(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FineRemotePeerSession = api;
}(typeof globalThis === "undefined" ? window : globalThis, () => {
  function request(peer, remoteId, { onOpen, onResponse, onError, onState = () => {} }, timeoutMs = 15000) {
    const connection = peer.connect(remoteId, {
      reliable: true,
      serialization: "json",
      metadata: { type: "connection-request", from: peer.id },
    });
    let finished = false;
    const timeout = setTimeout(() => fail(new Error("The peer did not answer in time.")), timeoutMs);

    function finish() {
      finished = true;
      clearTimeout(timeout);
      removePeerErrorListener();
    }

    function fail(error) {
      if (finished) return;
      finish();
      connection.close();
      onError(error);
    }

    // PeerJS reports some negotiation failures on Peer instead of the
    // DataConnection. Surface those immediately rather than waiting to time out.
    function handlePeerError(error) {
      if (error?.type === "peer-unavailable" || error?.type === "network" || error?.type === "webrtc") fail(error);
    }

    function removePeerErrorListener() {
      if (typeof peer.off === "function") peer.off("error", handlePeerError);
      else if (typeof peer.removeListener === "function") peer.removeListener("error", handlePeerError);
    }

    if (typeof peer.on === "function") peer.on("error", handlePeerError);

    connection.on("open", () => {
      onState("connected");
      onOpen(connection);
    });
    connection.on("data", (message) => {
      if (message?.type !== "connection-response" || finished) return;
      finish();
      onResponse(message, connection);
    });
    connection.on("error", fail);
    connection.on("close", () => {
      if (!finished) fail(new Error("The peer closed the connection."));
    });
    const watchIceState = () => {
      const state = connection.peerConnection?.iceConnectionState;
      if (state) onState(state);
      if ((state === "failed" || state === "closed") && !finished) {
        fail(new Error("A direct WebRTC route to the peer could not be established."));
      }
    };
    connection.peerConnection?.addEventListener?.("iceconnectionstatechange", watchIceState);
    watchIceState();
    return connection;
  }

  function answer(connection, confirmRequest, onAccepted = () => {}) {
    const request = connection.metadata;
    if (request?.type !== "connection-request") {
      connection.close();
      return;
    }
    const respond = () => {
      const accepted = confirmRequest(request.from || connection.peer);
      connection.send({ type: "connection-response", accepted });
      if (accepted) onAccepted(request.from || connection.peer);
      if (!accepted) setTimeout(() => connection.close(), 100);
    };
    // PeerJS may already have opened an incoming connection before delivering it.
    if (connection.open) respond();
    else connection.on("open", respond);
  }

  return { request, answer };
}));
