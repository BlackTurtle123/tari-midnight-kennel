# Verification record

Environment: local Linux development checkout, 15 October 2026. Node 22 runtime, walletd v0.46.1 connected to Esmeralda. Contract tests use the real local Tari engine; no public template/component address has been recorded yet.

## Developer checks

- PASS: WASM release contract builds.
- PASS: seven engine integration tests: real NFT deposit plus replay rejection, outsider rejection, changed opening rejection with subsequent valid hatch, reseal rejection, operator-only seal/no early hatch, duplicate reservation and supply cap, sealed state excludes the secret opening.
- PASS: five TypeScript tests for six-variant memo round-trips/size, malformed openings, fresh salt commitments, CBOR-tag NFT metadata, journal reload/integrity and public-state redaction.
- PASS: TypeScript check and Vite production build.
- PASS: running local API rejects anonymous state reads (401), mutation without request header (403), and foreign Origin (403); dedicated local wallet connect succeeds (200).
- BLOCKED: public deployment, encrypted memo round-trip, live UI hatch and populated NFT inventory. Public faucet funding rejected the fixed claim because its balance was below the claim size. No mock transactions are substituted.

## Browser observations

Codex in-app browser, local production frontend at http://127.0.0.1:8787:

- PASS: desktop incubator shows original canine art, three haunted doors and game steps.
- PASS: 390 × 844 mobile viewport stacks door cards; decorative overflow fixed and document scroll width equals client width.
- PASS: Spooky Secrets page shows privacy boundaries, official rule links, UTC deadline and outstanding submission checklist.
- PASS: wallet connection dialog explains local test-wallet use; connecting succeeds with the dedicated wallet daemon.
- PASS: undeployed setup warning appears; all three mint-entry door buttons are disabled.
- PENDING: private preview, on-chain mint confirmation, populated collection and reload persistence require funded deployment.

## Frontend acceptance handoff

Prerequisite: developer provides the running app with funded Esmeralda player/operator accounts and a deployed incubator. The administrator only needs a browser.

1. Open the app. Expect Halloween artwork, testnet label and three named doors; on a phone, cards should stack without horizontal scrolling.
2. Open Spooky Secrets. Expect the secret’s purpose, what becomes public, operator trust limits, official links and 1 November 2026 00:00 UTC cutoff.
3. Connect the test wallet. Expect a connected state. If the setup warning is visible, mark the remaining gameplay cases **Blocked: funded deployment unavailable**.
4. Knock once. Expect one incubation progressing; additional door buttons should remain disabled until it finishes.
5. Open the delivered secret. Expect a private canine preview, with an explicit warning that minting publishes its traits.
6. Close the preview. Expect no NFT yet; reopen it and expect the same canine.
7. Choose Reveal & mint NFT. Expect confirmation followed by exactly one canine in My canines, with its name and NFT details.
8. Reload. Expect the same NFT. Repeated confirmation/progress checks must not add a second NFT.
9. Disconnect. Expect wallet controls to reset and no private preview remaining visible.

Report: case number, **Pass / Fail / Blocked**, actual visible result, browser/device, and screenshot or recording for failures. Do not infer a live pass from source review or local engine tests.
