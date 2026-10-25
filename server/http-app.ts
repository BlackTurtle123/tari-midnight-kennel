import express from "express";
import { resolve } from "node:path";
import { z } from "zod";
import type { ExternalService } from "./external-service.ts";
import type { CommunityService } from "./community.ts";
interface Options {
  origin: string;
  additionalOrigins?: string[];
  basePath: string;
  hosted: boolean;
  version: string;
  health(): Promise<boolean>;
  community?: Pick<CommunityService, "ranking" | "farm">;
  external: Pick<
    ExternalService,
    "config" | "prepare" | "register" | "resume" | "state"
  >;
}
export function createApp(options: Options) {
  const app = express();
  const publicUrls = [options.origin, ...(options.additionalOrigins ?? [])].map(origin => {
    const url = new URL(origin);
    if (options.hosted && url.protocol !== "https:") throw new Error("Hosted mode requires HTTPS");
    if (url.origin !== origin) throw new Error("Public origins must not contain paths or credentials");
    return url;
  });
  const allowedHosts = new Set(publicUrls.map(url => url.hostname));
  if (!/^\/(?:[a-z0-9-]+\/)*$/.test(options.basePath))
    throw new Error("Invalid base path");
  const allowedOrigins = new Set([
    ...publicUrls.map(url => url.origin),
    ...(options.hosted
      ? []
      : ["http://127.0.0.1:5173", "http://localhost:5173"]),
  ]);
  const counters = new Map<string, { count: number; until: number }>();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "8kb" }));
  app.use((_req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    res.set("Content-Security-Policy", "frame-ancestors 'none'");
    next();
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !allowedHosts.has(req.hostname) &&
      !(
        req.path === "/health" &&
        ["127.0.0.1", "localhost"].includes(req.hostname)
      )
    )
      return res.status(403).json({ error: "Host is not permitted" });
    if (req.headers.origin && !allowedOrigins.has(req.headers.origin))
      return res.status(403).json({ error: "Origin is not permitted" });
    if (req.method !== "GET") {
      if (req.headers["x-kennel-request"] !== "1")
        return res.status(403).json({ error: "Missing request header" });
      // Proxy overwrites this header; direct host port is loopback-only.
      const key = String(
        req.headers["x-real-ip"] || req.socket.remoteAddress || "local",
      );
      const now = Date.now();
      for (const [k, v] of counters) if (v.until < now) counters.delete(k);
      const entry = counters.get(key) || { count: 0, until: now + 60_000 };
      entry.count++;
      counters.set(key, entry);
      if (entry.count > 30)
        return res
          .status(429)
          .json({ error: "Please wait a minute before trying again" });
    }
    next();
  });
  app.get("/api/config", (_req, res) =>
    res.json({
      walletMode: "external",
      network: "Esmeralda",
      version: options.version,
    }),
  );
  app.get("/api/health", async (_req, res) =>
    res.json({
      network: "esmeralda",
      walletReady: await options.health(),
      version: options.version,
    }),
  );
  if (options.community) {
    app.get("/api/community/ranking", async (_req, res) =>
      res.json(await options.community!.ranking()));
    app.get("/api/community/farms/:account", async (req, res) => {
      const account = z.string().regex(/^component_[a-f0-9]{64}$/).parse(req.params.account);
      const farm = await options.community!.farm(account);
      if (!farm) return res.status(404).json({ error: "This farm is not in the game directory yet." });
      res.json(farm);
    });
  }
  // Retired player-signing routes fail closed even for valid historical cookies.
  // Do not clear those cookies: their identities remain useful for asset recovery.
  app.use("/api", (req, res, next) => {
    if (
      /^\/(?:connect|disconnect|state|fund|incubations|rebirths|economy|wallet)(?:\/|$)/.test(
        req.path,
      )
    )
      return res.status(410).json({
        error:
          "Legacy wallet login is retired. Connect your external Esmeralda wallet. Existing wallet data is preserved for recovery.",
      });
    next();
  });
  if (options.external) {
    const external = options.external;
    const account = z.string().regex(/^component_[a-f0-9]{64}$/);
    const id = z.string().regex(/^[a-f0-9]{32}$/);
    const intent = z
      .object({
        account,
        component: account,
        paymentAddress: z
          .string()
          .regex(/^otl_esm_[a-z0-9]+$/)
          .max(512),
        nonce: z.string().regex(/^[a-f0-9]{64}$/),
        door: z.number().int().min(0).max(2),
        fee: z.object({
          component: account,
          treasury: account,
          amount: z.literal(20_000_000),
        }).strict().optional(),
      })
      .strict();
    // External connections never create a hosted account, set cookies, accept keys,
    // or expose the operator's opening. Only public chain data is returned.
    app.get("/api/external/config", (_req, res) => res.json(external.config()));
    app.get("/api/external/state", async (req, res) =>
      res.json(await external.state(account.parse(req.query.account))),
    );
    app.post("/api/external/prepare", async (req, res) =>
      res.json(await external.prepare(intent.parse(req.body))),
    );
    app.post("/api/external/register", async (req, res) => {
      const body = z.object({ intent, id }).strict().parse(req.body);
      res.json(await external.register(body.intent, body.id));
    });
    app.post("/api/external/resume", async (req, res) => {
      const body = z.object({ account, id }).strict().parse(req.body);
      res.json(await external.resume(body.account, body.id));
    });
  }
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API endpoint not found" }),
  );
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) =>
      res.status(error instanceof z.ZodError ? 400 : 503).json({
        error:
          error instanceof Error
            ? error.message.slice(0, 600)
            : "Request failed",
      }),
  );
  return app;
}
