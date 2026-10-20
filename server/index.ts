import { startEconomyKeeper } from "./economy-keeper.ts";
import { wallet } from "./wallet.ts";
import { createApp } from "./http-app.ts";
import { ExternalService } from "./external-service.ts";
const hosted = process.env.KENNEL_HOSTED === "true";
const port = Number(process.env.PORT || 8787);
const app = createApp({
  hosted,
  origin: process.env.KENNEL_PUBLIC_ORIGIN || `http://127.0.0.1:${port}`,
  basePath: process.env.KENNEL_BASE_PATH || "/",
  version: process.env.KENNEL_VERSION || "development",
  external: new ExternalService(),
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
});
app.listen(port, process.env.KENNEL_BIND_HOST || "127.0.0.1", () =>
  console.log(`Arkimals API listening on port ${port}`),
);
startEconomyKeeper();
