import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { wallet } from "../server/wallet.ts";
import { DATA_DIR, OPERATOR_NAME } from "../server/config.ts";
mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const daemon = spawn(
  "/usr/local/bin/tari_ootle_walletd",
  [
    "--base-path",
    DATA_DIR + "/wallet",
    "--config",
    "/run/kennel-secrets/wallet.toml",
    "--network",
    "esmeralda",
    "--indexer-api-url",
    "https://ootle-indexer-a.tari.com/",
    "--indexer-api-url",
    "https://ootle-indexer-b.tari.com/",
    "--listen-on",
    "127.0.0.1:15101",
    "--authentication",
    "none",
    "run",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
for (const stream of [daemon.stdout, daemon.stderr])
  createInterface({ input: stream }).on("line", (line) => {
    if (
      /password|seed.?words|mnemonic|token|invalid value for.*ootle_wallet_daemon/i.test(
        line,
      )
    )
      console.error("[wallet] Private configuration detail omitted.");
    else console.log(line);
  });
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopping = true;
    daemon.kill(signal);
  });
daemon.once("exit", (code) => process.exit(stopping ? 0 : code || 1));
let connected = false;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const client = await wallet();
    for (const name of [OPERATOR_NAME])
      await client.accountsCreateOrGet({
        account: { Name: name },
        is_default: false,
        key_index: null,
      });
    connected = true;
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
if (!connected) {
  console.error(
    "Wallet startup did not become ready. Check the protected wallet configuration.",
  );
  daemon.kill("SIGTERM");
  process.exitCode = 1;
} else {
  // Opt-in activation runs only after the deployment gateway's verified state
  // capture. The script keeps durable submission markers and creates an additive
  // descriptor; an unknown acknowledgement blocks automatic re-publication.
  if (process.env.KENNEL_ACTIVATE_INCUBATION_TREASURY === "true" &&
      !existsSync(DATA_DIR + "/incubation-treasury-v1.json")) {
    try {
      await import("../scripts/deploy-incubation-treasury.ts");
    } catch {
      console.error("Incubation treasury activation did not finish. Preserve its journal and reconcile receipts before retrying.");
      // Keep existing wallets, NFTs and public browsing available. The API
      // blocks new reservations until the opted-in treasury descriptor exists.
    }
  }
  await import("../server/index.ts");
}
