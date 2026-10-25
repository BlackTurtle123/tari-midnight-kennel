import { createServer } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const INDEXER_ROUTE = "http://127.0.0.1:15102/";
const SOURCES = ["https://ootle-indexer-a.tari.com/", "https://ootle-indexer-b.tari.com/"];

// Compare actual handover progress, not HTTP liveness or base-layer epochs.
// This is source selection only: walletd and IndexerProvider still verify proofs.
export class CheckpointSelector {
  private cached?: { url: string; epoch: number; until: number };
  private pending?: Promise<string>;
  private furthest = -1;
  constructor(
    private readonly sources = SOURCES,
    private readonly request: typeof fetch = fetch,
    private readonly now = Date.now,
  ) {}
  invalidate() { this.cached = undefined; }
  select(): Promise<string> {
    if (this.cached && this.cached.until > this.now()) return Promise.resolve(this.cached.url);
    return this.pending ??= this.compare().finally(() => { this.pending = undefined; });
  }
  private async compare() {
    const results = await Promise.allSettled(this.sources.map(async url => {
      const response = await this.request(new URL("epoch-checkpoints/latest?shard=1&include_committees=true", url), {
        signal: AbortSignal.timeout(6000), redirect: "error",
      });
      if (!response.ok) throw new Error("Checkpoint unavailable");
      const { checkpoint } = await response.json();
      if (!Number.isSafeInteger(checkpoint?.epoch) || checkpoint.epoch < 0 ||
          checkpoint.shard_group?.start !== 1 || !Number.isSafeInteger(checkpoint.shard_group.end_inclusive))
        throw new Error("Invalid checkpoint response");
      return { url, epoch: checkpoint.epoch as number };
    }));
    const candidates = results.flatMap(r => r.status === "fulfilled" ? [r.value] : [])
      .filter(r => r.epoch >= this.furthest)
      .sort((a, b) => b.epoch - a.epoch ||
        Number(b.url === this.cached?.url) - Number(a.url === this.cached?.url));
    const selected = candidates[0];
    if (!selected) throw new Error("No indexer serves the latest observed checkpoint");
    this.furthest = selected.epoch;
    this.cached = { ...selected, until: this.now() + 15_000 };
    return selected.url;
  }
}

// Local-only transport shared by the game reader and wallet. Each incoming
// request is forwarded exactly once, including transaction submissions.
export async function startIndexerRouter(port = 15102, selector = new CheckpointSelector()) {
  const server = createServer(async (req, res) => {
    try {
      if (!req.url?.startsWith("/") || req.url.startsWith("//") || !["GET", "POST"].includes(req.method ?? "")) {
        res.writeHead(400).end(); return;
      }
      const source = await selector.select();
      const target = new URL(source);
      const path = new URL(req.url, INDEXER_ROUTE);
      target.pathname = path.pathname;
      target.search = path.search;
      const abort = new AbortController();
      res.once("close", () => abort.abort());
      const headers = new Headers();
      for (const key of ["content-type", "accept", "last-event-id"])
        if (typeof req.headers[key] === "string") headers.set(key, req.headers[key]);
      const response = await fetch(target, {
        method: req.method, headers, redirect: "error", signal: abort.signal,
        ...(req.method === "POST" ? { body: Readable.toWeb(req) as ReadableStream, duplex: "half" } : {}),
      });
      if (response.status >= 500) selector.invalidate();
      res.statusCode = response.status;
      for (const key of ["content-type", "cache-control", "retry-after"])
        if (response.headers.has(key)) res.setHeader(key, response.headers.get(key)!);
      if (response.body) await pipeline(Readable.fromWeb(response.body as never), res);
      else res.end();
    } catch {
      selector.invalidate();
      // Never retry or expose request bodies: transfers carry private memos.
      if (!res.headersSent) res.writeHead(503, { "content-type": "application/json" }).end(JSON.stringify({ error: "Indexer checkpoint data is temporarily unavailable" }));
      else res.destroy();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}
