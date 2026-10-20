import { wallet } from "../server/wallet.ts";
import { OPERATOR_NAME } from "../server/config.ts";
const client = await wallet();
let failed = false;
for (const name of [OPERATOR_NAME]) {
  const result = await client.accountsCreateOrGet({
    account: { Name: name },
    is_default: false,
    key_index: null,
  });
  console.log(`${name}: ${result.account.component_address}`);
  const balances = await client
    .accountsGetBalances({ account: { Name: name }, refresh: true })
    .catch(() => null);
  if (result.created || !balances || balances.balances.length === 0) {
    console.log(`Funding ${name} with Esmeralda faucet coins…`);
    try {
      await client.createFreeTestCoins({
        account: { Name: name },
        max_fee: 100_000,
      });
      console.log(`${name} funded.`);
    } catch (error) {
      failed = true;
      console.error(
        `${name}: funding unavailable. ${error instanceof Error ? error.message : "Faucet failed"}`,
      );
    }
  } else console.log(`${name} already has balances; skipping faucet.`);
}

if (failed) process.exitCode = 1;
