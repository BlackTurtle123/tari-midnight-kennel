import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createOpening,
  commitmentFor,
  encodeMemo,
  decodeMemo,
} from "./crypto.ts";
import { parseCanine } from "./nft.ts";
const id = "0123456789abcdef0123456789abcdef";
test("all six private openings round-trip within Tari memo size", () => {
  for (let variant = 0; variant < 6; variant++) {
    const opening = { ...createOpening(id), variant };
    assert.ok(Buffer.byteLength(encodeMemo(opening)) < 255);
    assert.deepEqual(decodeMemo(encodeMemo(opening)), opening);
    assert.match(commitmentFor(opening), /^[a-f0-9]{64}$/);
    assert.notEqual(
      commitmentFor(opening),
      commitmentFor({ ...opening, variant: (variant + 1) % 6 }),
    );
  }
});
test("malformed secrets fail closed", () => {
  for (const memo of [
    "",
    "MK1:" + id + ":6:" + "a".repeat(64),
    encodeMemo(createOpening(id)) + "x",
  ])
    assert.equal(decodeMemo(memo), null);
  assert.throws(() =>
    commitmentFor({ id, variant: NaN, salt: "a".repeat(64) }),
  );
  assert.throws(() => commitmentFor({ id, variant: 0, salt: "short" }));
});
test("fresh salt hides the small outcome space", () => {
  const a = createOpening(id),
    b = { ...createOpening(id), variant: a.variant };
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(commitmentFor(a), commitmentFor(b));
});
test("inventory decodes native CBOR tag envelope and rejects malformed metadata", () => {
  const data = {
    variant: "0",
    incubation_id: id,
    name: "Pumpkin Pup",
    genes: "AAAABBBB",
    generation: "0",
  };
  assert.equal(
    parseCanine({ "@cbor": "tag", tag: 128, value: data }, "resource_test")
      ?.name,
    "Pumpkin Pup",
  );
  assert.equal(parseCanine(data, "resource_test")?.id, id);
  assert.equal(parseCanine({ ...data, variant: "" }, "resource_test"), null);
  assert.equal(
    parseCanine({ "@cbor": "tag", value: null }, "resource_test"),
    null,
  );
});
