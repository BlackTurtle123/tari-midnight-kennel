import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Journal, publicRecord, type Incubation } from "./journal.ts";
import { createOpening, commitmentFor } from "./crypto.ts";
test("journal keeps full prior records, reloads latest and excludes secrets from public state", () => {
  const dir = mkdtempSync(join(tmpdir(), "kennel-journal-test-"));
  const opening = createOpening("1".repeat(32));
  const record: Incubation = {
    id: opening.id,
    owner: "alice",
    opening,
    commitment: commitmentFor(opening),
    door: 0,
    stage: "reserved",
    createdAt: new Date().toISOString(),
  };
  const journal = new Journal(dir);
  journal.save(record);
  journal.save({ ...record, stage: "ready", startTx: "accepted-tx" });
  const entries = readFileSync(join(dir, "incubations-v2.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((s) => JSON.parse(s));
  assert.deepEqual(entries[0].record, record);
  assert.equal(entries.length, 2);
  assert.equal(new Journal(dir).get(record.id)?.stage, "ready");
  assert.equal(journal.list("bob").length, 0);
  const visible = JSON.stringify(publicRecord({ ...record, privateNote: "PRIVATE-NOTE" } as Incubation));
  assert.ok(!visible.includes("PRIVATE-NOTE"));
  assert.ok(!visible.includes(opening.salt));
  assert.ok(!visible.includes("opening"));
  // Corruption fixture is a separate file: preserve original journal for diagnosis.
  const corrupt = mkdtempSync(join(tmpdir(), "kennel-corrupt-test-"));
  writeFileSync(
    join(corrupt, "incubations-v2.jsonl"),
    readFileSync(join(dir, "incubations-v2.jsonl"), "utf8").replace(
      "accepted-tx",
      "altered-tx",
    ),
  );
  assert.throws(() => new Journal(corrupt), /integrity/);
  assert.match(
    readFileSync(join(corrupt, "incubations-v2.jsonl"), "utf8"),
    /altered-tx/,
  );
});
