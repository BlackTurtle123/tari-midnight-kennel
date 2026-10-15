import express from "express";
import { resolve } from "node:path";
import { z } from "zod";
import type { GameState } from "../shared/game.ts";
import { Sessions } from "./sessions.ts";
export interface Backend {
  state(): Promise<GameState>;
  start(door: number, id: string): Promise<unknown>;
  resume(id: string): Promise<unknown>;
  preview(id: string): Promise<unknown>;
  hatch(id: string): Promise<unknown>;
}
interface Options {
  origin: string;
  basePath: string;
  hosted: boolean;
  sessionSecret: string;
  version: string;
  backend(account: string): Promise<Backend>;
  health(): Promise<boolean>;
  fund(account: string): Promise<unknown>;
}
export function createApp(options: Options) {
  const app = express();
  const sessions = new Sessions(options.sessionSecret);
  const publicUrl = new URL(options.origin);
  if (options.hosted && publicUrl.protocol !== "https:")
    throw new Error("Hosted mode requires HTTPS");
  if (!/^\/(?:[a-z0-9-]+\/)*$/.test(options.basePath))
    throw new Error("Invalid base path");
  const allowedOrigins = new Set([
    options.origin,
    ...(options.hosted
      ? []
      : ["http://127.0.0.1:5173", "http://localhost:5173"]),
  ]);
  const counters = new Map<string, { count: number; until: number }>();
  const cookieName = options.hosted
    ? "kennel_staging_session"
    : "kennel_session";
  const cookieOptions = {
    httpOnly: true,
    secure: options.hosted,
    sameSite: "strict" as const,
    path: options.basePath,
    maxAge: 30 * 86400_000,
  };
  function identity(req: express.Request, name = cookieName) {
    const value = (req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(name + "="))
      ?.slice(name.length + 1);
    const id = sessions.read(value);
    return id
      ? {
          id,
          token: value!,
          account: options.hosted ? sessions.account(id) : "local",
        }
      : null;
  }
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
      req.hostname !== publicUrl.hostname &&
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
      hosted: options.hosted,
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
  app.post("/api/connect", async (req, res) => {
    const existing = identity(req) || identity(req, cookieName + "_identity");
    const token = existing?.token || sessions.issue();
    const id = sessions.read(token)!;
    const backend = await options.backend(
      options.hosted ? sessions.account(id) : "local",
    );
    const state = await backend.state();
    res.cookie(cookieName, token, cookieOptions);
    res.cookie(cookieName + "_identity", token, cookieOptions);
    res.json(state);
  });
  app.use("/api", async (req, res, next) => {
    const session = identity(req);
    if (!session)
      return res
        .status(401)
        .json({ error: "Connect your test wallet to continue" });
    res.locals.account = session.account;
    res.locals.backend = await options.backend(session.account);
    next();
  });
  app.post("/api/disconnect", (_req, res) => {
    res.clearCookie(cookieName, cookieOptions);
    res.json({ ok: true });
  });
  app.get("/api/state", async (_req, res) =>
    res.json(await (res.locals.backend as Backend).state()),
  );
  app.post("/api/fund", async (_req, res) =>
    res.json(await options.fund(res.locals.account)),
  );
  app.post("/api/incubations", async (req, res) => {
    const { door, id } = z
      .object({
        door: z.number().int().min(0).max(2),
        id: z.string().regex(/^[a-f0-9]{32}$/),
      })
      .strict()
      .parse(req.body);
    res.status(202).json(await (res.locals.backend as Backend).start(door, id));
  });
  const idSchema = z.string().regex(/^[a-f0-9]{32}$/);
  for (const method of ["resume", "preview", "hatch"] as const) {
    app.post(
      "/api/incubations/:id/" + (method === "preview" ? "open" : method),
      async (req, res) =>
        res.json(
          await (res.locals.backend as Backend)[method](
            idSchema.parse(req.params.id),
          ),
        ),
    );
  }
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) =>
      res
        .status(error instanceof z.ZodError ? 400 : 503)
        .json({
          error:
            error instanceof Error
              ? error.message.slice(0, 600)
              : "Request failed",
        }),
  );
  return app;
}
