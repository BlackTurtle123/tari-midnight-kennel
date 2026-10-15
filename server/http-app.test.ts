import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
function fetch(
  url: string,
  init: { method?: string; headers?: Record<string, string> } = {},
) {
  return new Promise<Response>((resolve, reject) => {
    const req = httpRequest(url, init, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const headers = new Headers();
        for (const [k, v] of Object.entries(res.headers))
          for (const value of Array.isArray(v) ? v : v ? [v] : [])
            headers.append(k, value);
        resolve(new Response(data, { status: res.statusCode, headers }));
      });
    });
    req.on("error", reject);
    req.end();
  });
}
import { createApp, type Backend } from "./http-app.ts";
test("hosted HTTP sessions isolate players, reject CSRF and retain reconnect identity", async () => {
  const app = createApp({
    hosted: true,
    origin: "https://staging.example.test",
    basePath: "/tari/",
    sessionSecret: "a".repeat(64),
    version: "test",
    health: async () => true,
    fund: async (account) => ({ account }),
    backend: async (account) =>
      ({
        state: async () => ({
          connected: true,
          network: "Esmeralda",
          account,
          incubations: [],
          canines: [],
        }),
        start: async () => ({}),
        resume: async () => ({}),
        preview: async () => ({}),
        hatch: async () => ({}),
      }) satisfies Backend,
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/api`;
  const headers = {
    host: "staging.example.test",
    origin: "https://staging.example.test",
    "x-kennel-request": "1",
  };
  try {
    assert.equal((await fetch(url + "/state", { headers })).status, 401);
    assert.equal(
      (
        await fetch(url + "/connect", {
          method: "POST",
          headers: { ...headers, origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(url + "/connect", {
          method: "POST",
          headers: { host: headers.host },
        })
      ).status,
      403,
    );
    const alice = await fetch(url + "/connect", { method: "POST", headers }),
      bob = await fetch(url + "/connect", { method: "POST", headers });
    assert.equal(alice.status, 200);
    assert.equal(bob.status, 200);
    const a = (await alice.json()) as { account: string },
      b = (await bob.json()) as { account: string };
    assert.notEqual(a.account, b.account);
    const cookies = alice.headers.getSetCookie();
    assert.ok(
      cookies.every(
        (c) =>
          c.includes("Secure") &&
          c.includes("HttpOnly") &&
          c.includes("Path=/tari/"),
      ),
    );
    const auth = cookies
      .find((c) => c.startsWith("kennel_staging_session="))!
      .split(";")[0];
    const identity = cookies
      .find((c) => c.startsWith("kennel_staging_session_identity="))!
      .split(";")[0];
    const state = await fetch(url + "/state", {
      headers: { ...headers, cookie: auth },
    });
    assert.equal(
      ((await state.json()) as { account: string }).account,
      a.account,
    );
    assert.equal(
      (
        await fetch(url + "/state", {
          headers: { ...headers, cookie: identity },
        })
      ).status,
      401,
    );
    const reconnect = await fetch(url + "/connect", {
      method: "POST",
      headers: { ...headers, cookie: identity },
    });
    assert.equal(
      ((await reconnect.json()) as { account: string }).account,
      a.account,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
