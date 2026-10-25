import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { CheckpointSelector, startIndexerRouter } from "./indexer-routing.ts";

test("checkpoint progress selects A over a responsive but stale B, then follows B when it advances", async () => {
  let now = 0, calls = 0;
  const epochs: Record<string, number> = { a: 12672, b: 12567 };
  const request = (async (url: URL) => {
    calls++;
    return Response.json({ checkpoint: { epoch: epochs[url.hostname], shard_group: { start: 1, end_inclusive: 256 } } });
  }) as typeof fetch;
  const selector = new CheckpointSelector(["https://b/", "https://a/"], request, () => now);
  assert.equal(await selector.select(), "https://a/");
  await Promise.all([selector.select(), selector.select()]);
  assert.equal(calls, 2);
  epochs.b = 12673; now = 15_001;
  assert.equal(await selector.select(), "https://b/");
  epochs.a = epochs.b = 12671; now = 30_002;
  await assert.rejects(selector.select(), /latest observed checkpoint/);
});

test("unavailable or malformed sources are excluded without bypassing verification", async () => {
  const selector = new CheckpointSelector(["https://a/", "https://b/"], (async (url: URL) => {
    if (url.hostname === "a") throw new Error("Unavailable");
    return Response.json({ checkpoint: { epoch: "12673" } });
  }) as typeof fetch);
  await assert.rejects(selector.select(), /No indexer/);
});

test("a failed transaction POST is forwarded once, never replayed against the other indexer", async () => {
  let submissions = 0;
  const upstream = createServer((req, res) => {
    if (req.method === "POST") submissions++;
    req.resume();
    res.writeHead(503, { "content-type": "application/json" }).end('{"error":"temporarily unavailable"}');
  });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address() as { port: number };
  const selector = new CheckpointSelector([`http://127.0.0.1:${address.port}/`], (async () =>
    Response.json({ checkpoint: { epoch: 12672, shard_group: { start: 1, end_inclusive: 256 } } })) as typeof fetch);
  const router = await startIndexerRouter(0, selector);
  try {
    const port = (router.address() as { port: number }).port;
    const response = await fetch(`http://127.0.0.1:${port}/transactions`, { method: "POST", body: "saved-transaction" });
    assert.equal(response.status, 503);
    await response.text();
    assert.equal(submissions, 1);
  } finally {
    await Promise.all([new Promise<void>(resolve => router.close(() => resolve())), new Promise<void>(resolve => upstream.close(() => resolve()))]);
  }
});
