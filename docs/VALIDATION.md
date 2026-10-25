# Validation evidence

Live app: https://tari.staging.arkimals-game.com/

## Public testnet evidence

[ESMERALDA-DEPLOYMENT.json](ESMERALDA-DEPLOYMENT.json) preserves the public template/component addresses and accepted reservation, commitment, encrypted delivery and mint receipts from 15 October 2026. The observed preview and minted NFT matched PoodlOS Echelon, HHHHHHHH. Closing/reopening the preview preserved the outcome; collection reload retained one NFT.

That run used the earlier hosted-wallet UI. It establishes historical testnet delivery/mint evidence, **not** a current Sapient signing pass. The current app uses Sapient only. Old hosted signing endpoints return HTTP 410.

On 25 October, desktop browser checks on the dedicated HTTPS hostname verified loaded branding/artwork, the Hatch your arkimal action and wallet controls. API checks verified the deployed version, wallet readiness, origin restrictions and old-URL compatibility. No player transaction was performed during that hostname check.

## Reproducible developer checks

```sh
npm ci
npm test
npm run build
npm run contract:test
npm run breeding:test
npm run rebirth:test
cargo test --locked --manifest-path treasury-contract/Cargo.toml
npm audit
```

Application tests cover wallet intent binding, encrypted memo validation, secret exclusion, duplicate protection, input selection, checkpoint selection and receipt recovery. Rust tests execute the Tari engine locally; they do not submit public transactions. See [security review](SECURITY-REVIEW.md) for review scope and limitations.

## Current frontend acceptance — pending connected-wallet retest

Use Sapient on Esmeralda with test coins. Do not create another incubation if the wallet already has an unfinished one.

1. Open the app on desktop and mobile. Expect visible artwork and readable navigation.
2. Connect Sapient. Expect the matching account and existing wallet-held/staked collection.
3. For a fresh incubation, review the 20 test tTARI contribution and network fee, then approve once. Expect one saved incubation.
4. Open its delivered secret and grant viewing access. Expect a canine preview verified against the commitment.
5. Close and reopen the preview. Expect the same canine without a mint or new payment.
6. Choose reveal/mint and approve once. Expect exactly one matching NFT.
7. Reload and check progress. Expect the same outcome and collection, without replacement payments.
8. Disconnect. Expect the private preview to close.

Report case, Pass/Fail/Blocked, visible result, browser/device and a screenshot for failures. Source review, API checks and local tests do not establish a live wallet pass.
