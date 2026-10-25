import { test } from "node:test";
import assert from "node:assert/strict";
import { Sessions } from "./sessions.ts";
import { TARI_RESOURCE } from "./config.ts";
test("signed sessions isolate browser accounts and survive server restart", () => {
  const sessions = new Sessions("a".repeat(64)),
    token = sessions.issue();
  const id = sessions.read(token)!;
  assert.ok(id);
  assert.equal(new Sessions("a".repeat(64)).account(id), sessions.account(id));
  assert.notEqual(
    sessions.account(id),
    sessions.account(sessions.read(sessions.issue())!),
  );
  assert.equal(
    sessions.read(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a")),
    null,
  );
  assert.equal(new Sessions("b".repeat(64)).read(token), null);
  assert.equal(sessions.read("fake"), null);
  assert.throws(() => new Sessions("weak"));
});
test("native token matches the verified Esmeralda faucet resource", () => {
  assert.equal(
    TARI_RESOURCE,
    "resource_0101010101010101010101010101010101010101010101010101010101010101",
  );
});
