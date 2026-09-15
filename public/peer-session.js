(function exposePeerSession(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FineRemotePeerSession = api;
}(typeof globalThis === "undefined" ? window : globalThis, () => {
  function request(peer, remoteId, { onOpen, onResponse, onError }, timeoutMs = 15000) {
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
    }

    function fail(error) {
      if (finished) return;
      finish();
      connection.close();
      onError(error);
    }

    connection.on("open", () => onOpen(connection));
    connection.on("data", (message) => {
      if (message?.type !== "connection-response" || finished) return;
      finish();
      onResponse(message, connection);
    });
    connection.on("error", fail);
    connection.on("close", () => {
      if (!finished) fail(new Error("The peer closed the connection."));
    });
    return connection;
  }

  function answer(connection, confirmRequest, onAccepted = () => {}) {
    const request = connection.metadata;
    if (request?.type !== "connection-request") {
      connection.close();
      return;
    }
    connection.on("open", () => {
      const accepted = confirmRequest(request.from || connection.peer);
      connection.send({ type: "connection-response", accepted });
      if (accepted) onAccepted(request.from || connection.peer);
      if (!accepted) setTimeout(() => connection.close(), 100);
    });
  }

  return { request, answer };
}));
