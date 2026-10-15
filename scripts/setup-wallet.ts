import { wallet } from '../server/wallet.ts';
import { OPERATOR_NAME, PLAYER_NAME } from '../server/config.ts';
const client = await wallet();
for (const name of [OPERATOR_NAME, PLAYER_NAME]) {
  const result = await client.accountsCreateOrGet({ account: { Name: name }, is_default: name === PLAYER_NAME, key_index: null });
  console.log(`${name}: ${result.account.component_address}`);
  const balances = await client.accountsGetBalances({ account: { Name: name }, refresh: true }).catch(() => null);
  if (result.created || !balances || balances.balances.length === 0) {
    console.log(`Funding ${name} with Esmeralda faucet coins…`);
    await client.createFreeTestCoins({ account: { Name: name }, max_fee: 100_000 });
    console.log(`${name} funded.`);
  } else console.log(`${name} already has balances; skipping faucet.`);
}
