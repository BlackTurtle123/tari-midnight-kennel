import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
function fetch(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
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
    req.end(init.body);
  });
}
import { createApp } from "./http-app.ts";
import { Sessions } from "./sessions.ts";
test("external-only HTTP rejects retired signing routes even with a valid legacy identity", async () => {
  let preparations = 0;
  const app = createApp({
    hosted: true,
    origin: "https://staging.example.test",
    additionalOrigins: ["https://tari.staging.arkimals-game.com"],
    basePath: "/tari/",
    version: "test",
    health: async () => true,
    community: {
      ranking: async () => ({ updatedAt: "2026-10-20T00:00:00Z", stale: false, farms: [], totalNFTs: 0 }),
      farm: async (account) => account.endsWith("a".repeat(64)) ? {
        updatedAt: "2026-10-20T00:00:00Z", stale: false,
        farm: { account, total: 0, canines: 0, halloween: 0, staked: 0, nfts: [] },
      } : undefined,
    },
    external: {
      config: () => ({
        component: "component_" + "a".repeat(64),
        resource: "resource_" + "b".repeat(64),
        network: "esmeralda",
      }),
      state: async (account) => ({
        connected: true,
        network: "Esmeralda",
        account,
        incubations: [],
        canines: [],
      }),
      prepare: async () => {
        preparations++;
        return { ok: true };
      },
      register: async () => {
        throw new Error("Not used by this test");
      },
      resume: async () => ({ ok: true }),
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/api`;
  const token = new Sessions("a".repeat(64)).issue();
  const headers = {
    host: "staging.example.test",
    origin: "https://staging.example.test",
    "x-kennel-request": "1",
    "content-type": "application/json",
    cookie: `kennel_staging_session=${token}; kennel_staging_session_identity=${token}`,
  };
  try {
    const dedicated = { host: "tari.staging.arkimals-game.com", origin: "https://tari.staging.arkimals-game.com" };
    assert.equal((await fetch(url + "/config", { headers: dedicated })).status, 200);
    assert.equal((await fetch(url + "/config", { headers: { ...dedicated, origin: "https://near.staging.arkimals-game.com" } })).status, 403);
    assert.equal((await fetch(url + "/config", { headers: { ...dedicated, host: "evil.example" } })).status, 403);
    assert.equal((await fetch(url + "/config", { headers: { ...dedicated, origin: "http://tari.staging.arkimals-game.com" } })).status, 403);
    for (const [method, path] of [
      ["POST", "/connect"],
      ["POST", "/disconnect"],
      ["GET", "/state"],
      ["POST", "/fund"],
      ["POST", "/incubations"],
      ["POST", "/incubations/" + "a".repeat(32) + "/open"],
      ["POST", "/incubations/" + "a".repeat(32) + "/hatch"],
      ["POST", "/incubations/" + "a".repeat(32) + "/resume"],
      ["GET", "/rebirths"],
      ["POST", "/rebirths"],
      ["POST", "/rebirths/" + "a".repeat(64) + "/check"],
      ["POST", "/economy/actions"],
      ["GET", "/wallet/transfers"],
      ["POST", "/wallet/transfers/review"],
      ["POST", "/wallet/transfers/" + "a".repeat(32) + "/send"],
      ["POST", "/wallet/transfers/" + "a".repeat(32) + "/check"],
    ]) {
      const response = await fetch(url + path, { method, headers });
      assert.equal(response.status, 410, method + " " + path);
      assert.match((await response.json()).error, /external Esmeralda wallet/);
      assert.equal(
        response.headers.get("set-cookie"),
        null,
        "Retired identity must be preserved, not replaced or deleted",
      );
    }
    assert.equal(
      (
        await fetch(url + "/connect", {
          method: "POST",
          headers: { ...headers, cookie: "" },
        })
      ).status,
      410,
    );
    const state = await fetch(
      url + "/external/state?account=component_" + "a".repeat(64),
      { headers },
    );
    assert.equal(state.status, 200);
    assert.equal((await state.json()).account, "component_" + "a".repeat(64));
    assert.equal(state.headers.get("set-cookie"), null);
    assert.equal(
      (await fetch(url + "/external/state?account=bad", { headers })).status,
      400,
    );
    const config = await fetch(url + "/config", { headers });
    assert.equal((await config.json()).walletMode, "external");
    // Browsing is public: no signing, session cookie or wallet connection needed.
    const publicHeaders = { host: headers.host };
    const ranking = await fetch(url + "/community/ranking", { headers: publicHeaders });
    assert.equal(ranking.status, 200);
    assert.equal((await ranking.json()).totalNFTs, 0);
    assert.equal(ranking.headers.get("set-cookie"), null);
    const farm = await fetch(url + "/community/farms/component_" + "a".repeat(64), { headers: publicHeaders });
    assert.equal(farm.status, 200);
    assert.equal((await farm.json()).farm.total, 0);
    assert.equal((await fetch(url + "/community/farms/component_" + "b".repeat(64), { headers: publicHeaders })).status, 404);
    assert.equal((await fetch(url + "/community/farms/invalid", { headers: publicHeaders })).status, 400);
    assert.equal((await fetch(url + "/community/ranking", { headers: { host: "evil.example" } })).status, 403);
    assert.equal((await fetch(url + "/unrecognized", { headers })).status, 404);
    assert.equal(
      (
        await fetch(
          url + "/external/state?account=component_" + "a".repeat(64),
          { headers: { ...headers, host: "evil.example" } },
        )
      ).status,
      403,
    );
    const intent = {
      account: "component_" + "a".repeat(64),
      component: "component_" + "b".repeat(64),
      paymentAddress: "otl_esm_test",
      nonce: "c".repeat(64),
      door: 0,
    };
    for (const badHeaders of [
      { ...headers, origin: "https://evil.example" },
      { host: headers.host, "content-type": "application/json" },
    ]) {
      assert.equal(
        (
          await fetch(url + "/external/prepare", {
            method: "POST",
            headers: badHeaders,
            body: JSON.stringify(intent),
          })
        ).status,
        403,
      );
    }
    assert.equal(preparations, 0);
    assert.equal(
      (
        await fetch(url + "/external/prepare", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...intent, seed: "never accept seeds" }),
        })
      ).status,
      400,
    );
    assert.equal(preparations, 0);
    assert.equal(
      (
        await fetch(url + "/external/prepare", {
          method: "POST",
          headers,
          body: JSON.stringify(intent),
        })
      ).status,
      200,
    );
    assert.equal(preparations, 1);
    const fee = { component: intent.component, treasury: intent.account, amount: 20_000_000 };
    assert.equal((await fetch(url + "/external/prepare", { method: "POST", headers, body: JSON.stringify({ ...intent, fee }) })).status, 200);
    assert.equal(preparations, 2);
    assert.equal((await fetch(url + "/external/prepare", { method: "POST", headers, body: JSON.stringify({ ...intent, fee: { ...fee, amount: 1 } }) })).status, 400);
    assert.equal(preparations, 2);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
