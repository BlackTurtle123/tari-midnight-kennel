import { test } from "node:test";
import assert from "node:assert/strict";
import { readEpochHashes } from "./epoch-hashes.ts";
const hash = "f5fe7f8495b72f353c57c90382307079dde8514e0daa919c5c40f856d0798f62";
test("live integer-keyed epoch CBOR map remains captured after the draw epoch", () => {
  const epochs = readEpochHashes({ "@cbor": "map", entries: [[12511, hash]] });
  assert.equal(epochs[12511], hash);
  assert.equal(Object.hasOwn(epochs, "12511"), true);
  assert.equal(Object.hasOwn(epochs, "12512"), false);
  assert.equal(Object.keys(readEpochHashes({})).length, 0);
  assert.equal(readEpochHashes({ "12511": hash })[12511], hash);
});
test("epoch reader rejects malformed, duplicate or unsafe consensus entries", () => {
  for (const raw of [
    {
      "@cbor": "map",
      entries: [
        [12511, hash],
        [12511, hash],
      ],
    },
    { "@cbor": "map", entries: [[-1, hash]] },
    { "@cbor": "map", entries: [[12511, "bad"]] },
    { "@cbor": "map", entries: [[Number.MAX_SAFE_INTEGER + 1, hash]] },
    { "@cbor": "map", entries: [["12511", hash]] },
    { "012511": hash },
    { invalid: hash },
    null,
  ])
    assert.throws(() => readEpochHashes(raw));
});
