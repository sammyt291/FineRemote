const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { request, answer } = require("../public/peer-session");

class FakeConnection extends EventEmitter {
  constructor(peer, metadata) {
    super();
    this.peer = peer;
    this.metadata = metadata;
    this.sent = [];
    this.closed = false;
  }
  send(message) { this.sent.push(message); }
  close() { this.closed = true; }
}

test("sends the request as PeerJS connection metadata", () => {
  const connection = new FakeConnection("remote");
  const peer = {
    id: "local",
    connect(id, options) {
      assert.equal(id, "remote");
      assert.deepEqual(options.metadata, { type: "connection-request", from: "local" });
      assert.equal(options.serialization, "json");
      return connection;
    },
  };
  let opened = false;
  let response;
  request(peer, "remote", { onOpen: () => { opened = true; }, onResponse: (value) => { response = value; }, onError: assert.fail });
  connection.emit("open");
  connection.emit("data", { type: "connection-response", accepted: true });
  assert.equal(opened, true);
  assert.deepEqual(response, { type: "connection-response", accepted: true });
});

test("answers an incoming request when its data channel opens", () => {
  const connection = new FakeConnection("requester", { type: "connection-request", from: "requester" });
  let sharedWith;
  answer(connection, (from) => {
    assert.equal(from, "requester");
    return true;
  }, (from) => { sharedWith = from; });
  connection.emit("open");
  assert.deepEqual(connection.sent, [{ type: "connection-response", accepted: true }]);
  assert.equal(sharedWith, "requester");
});

test("rejects connections that are not requests", () => {
  const connection = new FakeConnection("unknown", {});
  answer(connection, assert.fail);
  assert.equal(connection.closed, true);
});
