import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { GameService, resumeRecoverableStarts } from "./game-service.ts";
import { wallet } from "./wallet.ts";
import { PLAYER_NAME } from "./config.ts";
import { createApp } from "./http-app.ts";
import { ExternalService } from "./external-service.ts";
import { Transfers, TransferStore } from "./transfers.ts";
import { serializeWallet } from "./wallet-queue.ts";
import { Rebirths } from "./rebirth.ts";
const hosted = process.env.KENNEL_HOSTED === "true";
const port = Number(process.env.PORT || 8787);
const services = new Map<string, GameService>();
let provisioning: Promise<unknown> = Promise.resolve();
async function backend(account: string) {
  const name = account === "local" ? PLAYER_NAME : account;
  if (services.has(name)) return services.get(name)!;
  const operation = provisioning
    .catch(() => undefined)
    .then(async () => {
      if (services.has(name)) return services.get(name)!;
      const w = await wallet();
      try {
        await w.accountsGet({ name_or_address: { Name: name } });
      } catch (error) {
        // Only create if the wallet explicitly reports no matching account.
        if (
          !/not found|does not exist/i.test(
            error instanceof Error ? error.message : "",
          )
        )
          throw error;
        const accounts = await w.accountsList({ offset: 0, limit: 1 });
        if (
          Number(accounts.total) >=
          Number(process.env.KENNEL_MAX_ACCOUNTS || 27)
        )
          throw new Error(
            "Staging test-wallet capacity reached. Ask the developer for access.",
          );
        await w.accountsCreateOrGet({
          account: { Name: name },
          is_default: false,
          key_index: null,
        });
      }
      const service = new GameService(name);
      services.set(name, service);
      return service;
    });
  provisioning = operation;
  return operation;
}
const secret = process.env.KENNEL_SESSION_SECRET_FILE
  ? readFileSync(process.env.KENNEL_SESSION_SECRET_FILE, "utf8").trim()
  : hosted
    ? ""
    : randomBytes(48).toString("hex");
const app = createApp({
  hosted,
  origin: process.env.KENNEL_PUBLIC_ORIGIN || `http://127.0.0.1:${port}`,
  basePath: process.env.KENNEL_BASE_PATH || "/",
  sessionSecret: secret,
  version: process.env.KENNEL_VERSION || "development",
  backend,
  external: new ExternalService(),
  rebirths: (() => {
    const service = new Rebirths(async (name) => (await backend(name)).state());
    const name = (account: string) =>
      account === "local" ? PLAYER_NAME : account;
    return {
      list: (account) => service.list(name(account)),
      confirm: (account, input) => service.confirm(name(account), input),
      check: (account, key) => service.check(name(account), key),
    };
  })(),
  transfers: (() => {
    const transfer = new Transfers(
      wallet,
      new TransferStore(),
      async (name) => (await backend(name)).state(),
      serializeWallet,
    );
    const name = (account: string) =>
      account === "local" ? PLAYER_NAME : account;
    return {
      list: (account) => transfer.list(name(account)),
      prepare: (account, input) => transfer.prepare(name(account), input),
      confirm: (account, id) => transfer.confirm(name(account), id),
      check: (account, id) => transfer.check(name(account), id),
    };
  })(),
  health: async () => {
    try {
      const client = await wallet();
      await client.walletGetInfo();
      // A reachable daemon alone does not prove its indexer is configured.
      await client.getFaucetBalance({});
      return true;
    } catch {
      return false;
    }
  },
  fund: async (account) => {
    await backend(account);
    try {
      const result = await (
        await wallet()
      ).createFreeTestCoins({
        account: { Name: account === "local" ? PLAYER_NAME : account },
        max_fee: 100_000,
      });
      return { ok: true, transactionId: result.transaction_id };
    } catch (error) {
      if (
        /faucet.*(enough|empty)/i.test(
          error instanceof Error ? error.message : "",
        )
      )
        throw new Error(
          "The public Esmeralda faucet has less than its fixed 1,000 tTARI claim. Receive test coins from a funded Esmeralda wallet, or use the official L1 testnet burn-and-claim route.",
        );
      throw error;
    }
  },
});
app.listen(port, process.env.KENNEL_BIND_HOST || "127.0.0.1", () =>
  console.log(`Midnight Kennel API listening on port ${port}`),
);

if (hosted)
  void resumeRecoverableStarts().catch(() =>
    console.error(
      "Legacy incubation recovery is waiting for wallet/indexer readiness; Check progress can retry safely.",
    ),
  );
