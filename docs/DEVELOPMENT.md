# Local development

## Setup

Prerequisites: Node.js 22.15+, npm, Rust stable with `wasm32-unknown-unknown`, and the official Tari Ootle wallet daemon **v0.47.0**. The contract pins `tari_template_lib 0.34.0` and tests use `tari_template_test_tooling 0.46.1`. Linux native build tools including a C/C++ compiler are required for engine tests. Download wallet binaries from [official Tari releases](https://github.com/tari-project/tari-ootle/releases/tag/v0.47.0).

Use a **new, dedicated testnet wallet**. The following local PoC configuration uses no wallet authentication and therefore must remain on loopback, on a trusted single-user development computer. Never expose it through a tunnel, reverse proxy or public host. Do not point this app at a valuable wallet.

```sh
mkdir -p "$HOME/.local/share/tari-midnight-kennel/wallet"
# Use a fresh directory; do not replace an existing wallet.
tari_ootle_walletd --base-path "$HOME/.local/share/tari-midnight-kennel/wallet" \
  --network esmeralda --indexer-api-url https://ootle-indexer-a.tari.com/ \
  --indexer-api-url https://ootle-indexer-b.tari.com/ \
  --listen-on 127.0.0.1:15101 --authentication none run
```

In a second terminal, from this repository:

```sh
npm ci
rustup target add wasm32-unknown-unknown
npm run contract:build
npm run setup:wallet
npm run deploy:contract
npm run staking:build
npm run rebirth:build
npm run deploy:economy
npm run dev
```

Open **http://127.0.0.1:5173**, connect your Esmeralda account through Sapient, and knock on a door. Leave the wallet and API running for the incubation. After a confirmed encrypted delivery, choose **Open privately**, then **Reveal & mint NFT**. Inspect **My pack** after confirmation. The confirmation may take several blocks; the UI polls actual state.

For a production frontend build served by the local API:

```sh
npm run build
npm start
# http://127.0.0.1:8787
```

Scripts enable Node’s experimental WASM module loader required by the pinned Tari SDK. The API listens only on loopback. The wallet network must be Esmeralda (network byte `0x26`); mainnet is refused.

### Testnet funding

Fund the operator with Esmeralda test coins before publishing contracts. Fund the player account separately in Sapient. Use the official [wallet funding guide](https://ootle.tari.com/guides/setup-a-wallet/); faucet availability changes. The operator pays publication and delivery network fees; players approve gameplay and their network fees. Setup does not purchase mainnet funds.

### Configuration and data

Environment overrides: `TARI_WALLET_URL` (default local port 15101 JSON RPC URL), `TARI_WALLET_TOKEN` (optional existing daemon token), `TARI_OPERATOR_ACCOUNT`, `KENNEL_DATA_DIR`, `PORT` (default 8787). See `server/config.ts` for exact defaults. Keep credentials in the environment, outside Git.

State is outside the repository, under `~/.local/share/tari-midnight-kennel` by default:

- `wallet/`: wallet database; keys may also depend on the OS keyring. Back up through Tari’s supported wallet procedures.
- `deployment-v2.json`: accepted template/component/resource addresses. Created exclusively, never overwritten automatically.
- `deployment-journal.jsonl`: publication/creation transaction receipts for resumption.
- `incubations-v2.jsonl`: append-only, hash-chained full record history; contains operator plaintext secrets. Directory/file modes are 0700/0600 when created. Keep this private and back it up before any manual repair.

A timeout is not a rejection: **Check progress** waits for the existing transaction. A rejected delivery transaction is retained for investigation, not automatically replaced. If a process or network fails between submission and recording its transaction ID, the app deliberately stops automatic resubmission. A developer must inspect the wallet’s transaction history and reconcile the missing receipt. There is no destructive reset button. Before repairing, copy the complete data directory outside itself and verify checksums; preserve keys separately as required by the wallet. Do not delete the journal to “retry”.

Players connect and sign through Sapient only, both locally and on staging. The operator daemon handles encrypted deliveries and draw capture. Legacy browser login and cookie-authenticated signing endpoints are retired; existing hosted wallets, seeds, cookies and journals remain intact for controlled recovery. No assets are automatically migrated. See [wallet connection and recovery](EXTERNAL-WALLET.md) and [staging setup](STAGING.md). A static frontend upload alone is not a functional game.

Page refresh silently restores an already-authorized Sapient connection when available, preserving the remembered account. Locked/revoked or absent wallets leave Connect available without a popup; public farms and rankings remain browsable. Disconnect clears the reconnect preference. The game shows only a small wallet balance; Send and Receive controls belong in the wallet extension.

