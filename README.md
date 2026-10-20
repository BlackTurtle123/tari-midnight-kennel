# Arkimals Halloween on Tari

A small canine incubation game for Tari Ootle’s October 2026 **Spooky Secrets** contest. Choose a haunted door, receive a secret canine outcome through a native encrypted wallet memo, then explicitly reveal and mint a real NFT.

**Live on [staging](https://staging.wavesducks.com/tari/): real Esmeralda incubation, encrypted memo preview, NFT mint and collection reload verified.** This is not yet a finished contest submission. No simulated minting or offline gameplay mode is included.

## Scope

- Three Halloween doorways; four current main-game genesis canines (E–H), using the original modular artwork and eight-position genome. All doors use the same outcome distribution.
- An incubation reserves one NFT; a salted commitment binds its outcome.
- The operator delivers the opening using a Tari stealth transfer with an encrypted memo.
- The player wallet decrypts the memo for a private preview.
- The owner chooses to reveal the opening. The contract verifies it, mints one canine NFT and deposits it atomically into the originally selected recipient.
- Collection UI reads actual wallet NFT inventory. It never fabricates a collectible.
- Halloween rebirth: offer one canine + 8 test tTARI, wait for a fixed future draw and mint one of six original-art Halloween NFTs. A separate NFT staking contract distributes 75% of completed ritual fees; 25% goes to the treasury. See [rebirth, staking and recovery](docs/REBIRTH.md).
- Supply of 100 per deployed event (contract supports 1–250), 12 reservations per signer, one unfinished incubation at a time in this UI. No artificial incubation timer.

Breeding, treasury yield, payments for gameplay and the broader economy are deferred. See [the full-game port checklist](docs/PORT-CHECKLIST.md), [privacy boundaries](docs/PRIVACY.md), [contest requirements](docs/CONTEST.md) and [verification status](docs/VALIDATION.md).

## Run against Esmeralda

Prerequisites: Node.js 22.15+, npm, Rust stable with `wasm32-unknown-unknown`, and the official Tari Ootle wallet daemon **v0.46.1**. The contract pins `tari_template_lib 0.34.0` and tests use `tari_template_test_tooling 0.46.1`. Linux native build tools including a C/C++ compiler are required for engine tests. Download wallet binaries from [official Tari releases](https://github.com/tari-project/tari-ootle/releases/tag/v0.46.1).

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

Open **http://127.0.0.1:5173**, connect the local test wallet, and knock on a door. Leave the wallet and API running for the incubation. After a confirmed encrypted delivery, choose **Open privately**, then **Reveal & mint NFT**. Inspect **My pack** after confirmation. The confirmation may take several blocks; the UI polls actual state.

For a production frontend build served by the local API:

```sh
npm run build
npm start
# http://127.0.0.1:8787
```

Scripts enable Node’s experimental WASM module loader required by the pinned Tari SDK. The API listens only on loopback. The wallet network must be Esmeralda (network byte `0x26`); mainnet is refused.

### Funding blocker

On 15 October 2026 the public Esmeralda faucet rejected the fixed 1,000 tTARI claim because its available balance was 999.651320 tTARI, below that claim. The pool needs another 0.348680 tTARI even for one claim. See [Tari wallet funding](https://ootle.tari.com/guides/setup-a-wallet/) and [L1 testnet burn-and-claim](https://ootle.tari.com/guides/burn-minotari/). `setup:wallet` creates both accounts and reports funding failures. Fund **both** `kennel-operator` and `kennel-player` using test coins and rerun setup/deploy. The operator needs the template publication fee and each seal/memo delivery fee; the player needs incubation and hatch fees. No mainnet purchase or burn is performed automatically.

Deployment estimates the template fee and refuses a budget above 100 tTARI. Subsequent calls have a 1 tTARI maximum fee. Each encrypted memo carries one microtari as a stealth output; it is a message carrier, not a game reward with financial value.

### Configuration and data

Environment overrides: `TARI_WALLET_URL` (default local port 15101 JSON RPC URL), `TARI_WALLET_TOKEN` (optional existing daemon token), `TARI_OPERATOR_ACCOUNT`, `TARI_PLAYER_ACCOUNT`, `KENNEL_DATA_DIR`, `PORT` (default 8787). See `server/config.ts` for exact defaults. Keep credentials in the environment, outside Git.

State is outside the repository, under `~/.local/share/tari-midnight-kennel` by default:

- `wallet/`: wallet database; keys may also depend on the OS keyring. Back up through Tari’s supported wallet procedures.
- `deployment-v2.json`: accepted template/component/resource addresses. Created exclusively, never overwritten automatically.
- `deployment-journal.jsonl`: publication/creation transaction receipts for resumption.
- `incubations-v2.jsonl`: append-only, hash-chained full record history; contains operator plaintext secrets. Directory/file modes are 0700/0600 when created. Keep this private and back it up before any manual repair.

A timeout is not a rejection: **Check progress** waits for the existing transaction. A confirmed rejection can be retried without changing the committed result. If a process or network fails between submission and recording its transaction ID, the app deliberately stops automatic resubmission. A developer must inspect the wallet’s transaction history and reconcile the missing receipt. There is no destructive reset button. Before repairing, copy the complete data directory outside itself and verify checksums; preserve keys separately as required by the wallet. Do not delete the journal to “retry”.

Local mode uses separate operator and player accounts in one daemon. The staging deployment adds a separate server-custodied test account per browser, signed session cookies and serialized operator processing. It is testnet-only; the server retains operator and existing hosted-player keys. New Sapient player keys remain in the extension. See [staging setup, funding and recovery](docs/STAGING.md). Sapient now provides a separate self-custody player connection; see [wallet connection and recovery](docs/EXTERNAL-WALLET.md). Production hosting remains future work. A static upload of this frontend is not a functional hosted game.

## Verify

Hosted test wallets can transfer test Tari and individual canine NFTs through a review-and-confirm flow. See [wallet transfers and seed backup](docs/WALLET-TRANSFERS.md). Sapient seed export stays inside the extension; the shared hosted master seed is never exposed to player sessions.

```sh
npm test
npm run build
npm run contract:test
```

Rust integration tests execute the real Tari engine and inspect the recipient vault for the NFT; they are not public testnet transactions. See [validation](docs/VALIDATION.md) for what was actually observed and what remains blocked.

## Project ownership

MIT licensed. New source and code-native SVG artwork created for this October entry; no other contest submission’s code is reused. Development assisted by AI. Built on the published Tari libraries and their official documentation. Jira: [TLK-1557](https://turtlelovers.atlassian.net/browse/TLK-1557).
