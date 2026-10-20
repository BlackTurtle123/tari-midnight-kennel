# Arkimals Halloween on Tari

A small canine incubation game for Tari Ootle’s October 2026 **Spooky Secrets** contest. Choose a haunted door, receive a secret canine outcome through a native encrypted wallet memo, then explicitly reveal and mint a real NFT.

**Live on [staging](https://staging.wavesducks.com/tari/): real Esmeralda incubation, encrypted memo preview, NFT mint and collection reload verified.** This is not yet a finished contest submission. No simulated minting or offline gameplay mode is included.

## Scope

- Three Halloween doorways; four current main-game genesis canines (E–H), using the original modular artwork and eight-position genome. All doors use the same outcome distribution.
- An incubation reserves one NFT; a salted commitment binds its outcome.
- The operator delivers the opening using a Tari stealth transfer with an encrypted memo.
- With the incubation treasury activated, a new reservation atomically pays 20 test tTARI into the operator treasury. Resume and hatch never collect a second treasury fee. Existing saved incubations remain recoverable without the new fee. See [treasury activation and recovery](docs/INCUBATION-TREASURY.md).
- The player wallet decrypts the memo for a private preview.
- The owner chooses to reveal the opening. The contract verifies it, mints one canine NFT and deposits it atomically into the originally selected recipient.
- Collection UI reads actual wallet NFT inventory. It never fabricates a collectible.
- Halloween rebirth: offer one canine + 8 test tTARI, wait for a fixed future draw and mint one of six original-art Halloween NFTs. A separate NFT staking contract distributes 75% of completed ritual fees; 25% goes to the treasury. See [rebirth, staking and recovery](docs/REBIRTH.md).
- Supply of 100 per deployed event (contract supports 1–250), 12 reservations per signer, one unfinished incubation at a time in this UI. No artificial incubation timer.

Breeding, native staking/leasing yield and the broader main-game economy are deferred. See [the full-game port checklist](docs/PORT-CHECKLIST.md), [privacy boundaries](docs/PRIVACY.md), [contest requirements](docs/CONTEST.md) and [verification status](docs/VALIDATION.md).

## Run against Esmeralda

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

### Funding blocker

On 15 October 2026 the public Esmeralda faucet rejected the fixed 1,000 tTARI claim because its available balance was 999.651320 tTARI, below that claim. The pool needs another 0.348680 tTARI even for one claim. See [Tari wallet funding](https://ootle.tari.com/guides/setup-a-wallet/) and [L1 testnet burn-and-claim](https://ootle.tari.com/guides/burn-minotari/). `setup:wallet` creates only `kennel-operator` and reports funding failures. Fund the operator with test coins and rerun setup/deploy. Fund your player account separately in Sapient. The operator needs the template publication fee and each seal/memo delivery fee; the player needs incubation and hatch fees. No mainnet purchase or burn is performed automatically.

Deployment estimates the template fee and refuses a budget above 100 tTARI. Subsequent calls have a 1 tTARI maximum fee. Each encrypted memo carries one microtari as a stealth output; it is a message carrier, not a game reward with financial value.

### Configuration and data

Environment overrides: `TARI_WALLET_URL` (default local port 15101 JSON RPC URL), `TARI_WALLET_TOKEN` (optional existing daemon token), `TARI_OPERATOR_ACCOUNT`, `KENNEL_DATA_DIR`, `PORT` (default 8787). See `server/config.ts` for exact defaults. Keep credentials in the environment, outside Git.

State is outside the repository, under `~/.local/share/tari-midnight-kennel` by default:

- `wallet/`: wallet database; keys may also depend on the OS keyring. Back up through Tari’s supported wallet procedures.
- `deployment-v2.json`: accepted template/component/resource addresses. Created exclusively, never overwritten automatically.
- `deployment-journal.jsonl`: publication/creation transaction receipts for resumption.
- `incubations-v2.jsonl`: append-only, hash-chained full record history; contains operator plaintext secrets. Directory/file modes are 0700/0600 when created. Keep this private and back it up before any manual repair.

A timeout is not a rejection: **Check progress** waits for the existing transaction. A confirmed rejection can be retried without changing the committed result. If a process or network fails between submission and recording its transaction ID, the app deliberately stops automatic resubmission. A developer must inspect the wallet’s transaction history and reconcile the missing receipt. There is no destructive reset button. Before repairing, copy the complete data directory outside itself and verify checksums; preserve keys separately as required by the wallet. Do not delete the journal to “retry”.

Players connect and sign through Sapient only, both locally and on staging. The operator daemon handles encrypted deliveries and draw capture. Legacy browser login and cookie-authenticated signing endpoints are retired; existing hosted wallets, seeds, cookies and journals remain intact for controlled recovery. No assets are automatically migrated. See [wallet connection and recovery](docs/EXTERNAL-WALLET.md) and [staging setup](docs/STAGING.md). A static frontend upload alone is not a functional game.

Page refresh silently restores an already-authorized Sapient connection when available, preserving the remembered account. Locked/revoked or absent wallets leave Connect available without a popup; public farms and rankings remain browsable. Disconnect clears the reconnect preference. The game shows only a small wallet balance; Send and Receive controls belong in the wallet extension.

## Verify

Transfers use Sapient’s Send controls. See [wallet transfers and seed backup](docs/WALLET-TRANSFERS.md). Sapient seed export stays inside the extension; the shared hosted master seed is never exposed to player sessions.

```sh
npm test
npm run build
npm run contract:test
```

Rust integration tests execute the real Tari engine and inspect the recipient vault for the NFT; they are not public testnet transactions. See [validation](docs/VALIDATION.md) for what was actually observed and what remains blocked.

## Project ownership

MIT licensed. New source and code-native SVG artwork created for this October entry; no other contest submission’s code is reused. Development assisted by AI. Built on the published Tari libraries and their official documentation. Jira: [TLK-1557](https://turtlelovers.atlassian.net/browse/TLK-1557).

### Main-game rule port

Rebirth and Staking now have separate pages (`#rebirth`, `#staking`). `#breeding` contains the parent selection and Sapient flow; `#rules` explains the main-game lifecycle and distinguishes deployed behavior from pending work. The [full rule checklist](docs/FULL-FLOW-RULES.md) is backed by captured public deployed Ride contracts and oracle values in `docs/main-game-rules`.

Activation uses `TARI_BREEDING_FEE=1000000 npm run deploy:breeding` (1 native test tTARI, not an EGG exchange rate), followed by `npm run deploy:offspring-economy`. The latter instantiates the existing tested staking/rebirth templates for the bred collection and writes additive `offspring-staking-v1.json` / `offspring-rebirth-v1.json` descriptors. Existing founding stakes, rebirths, resources and recovery journals are preserved. Each collection pool receives 75% of its own completed rebirth fees. Select Founding canines or Bred canines on Rebirth/Staking; both pools use equal shares and the six-art Halloween edition. Separate epoch capture journals keep both generations of pending requests recoverable.

This activates the supported canine lifecycle, not the remaining production rule inventory. The fixed incubation treasury fee is separate from the main game's supply-based pricing; perches, FP-weighted rewards and functional main-game items still require implementation. Do not present testnet activation as production readiness.

Verification: `npm test`, `npm run build`, `cargo test --locked --manifest-path breeding-contract/Cargo.toml`. Production readiness also requires the remaining gates in the checklist; this release does not claim complete main-game parity.
