const test = require("node:test");
const assert = require("node:assert/strict");
const { createFineRemoteServer, parseIceServers } = require("../server");

test("uses a working STUN-only default instead of PeerJS public TURN", () => {
  assert.deepEqual(parseIceServers(), [{ urls: "stun:stun.l.google.com:19302" }]);
});

test("validates configured ICE servers", () => {
  const configured = [{ urls: "turn:turn.example.com:3478", username: "user", credential: "secret" }];
  assert.deepEqual(parseIceServers(JSON.stringify(configured)), configured);
  assert.throws(() => parseIceServers("not JSON"), /valid JSON/);
  assert.throws(() => parseIceServers('[{"urls":"https://example.com"}]'), /ICE server objects/);
});

test("serves the ICE configuration to clients", async (t) => {
  const previous = process.env.FINE_REMOTE_ICE_SERVERS;
  process.env.FINE_REMOTE_ICE_SERVERS = '[{"urls":"stun:stun.example.com:3478"}]';
  const { httpServer } = createFineRemoteServer({ port: 0 });
  t.after(() => {
    httpServer.close();
    if (previous === undefined) delete process.env.FINE_REMOTE_ICE_SERVERS;
    else process.env.FINE_REMOTE_ICE_SERVERS = previous;
  });
  await new Promise((resolve) => httpServer.once("listening", resolve));

  const { port } = httpServer.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/config`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { iceServers: [{ urls: "stun:stun.example.com:3478" }] });
});
