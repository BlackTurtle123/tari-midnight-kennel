# Validation evidence

Live environment: https://staging.wavesducks.com/tari/, Codex in-app desktop browser, 15 October 2026. Gameplay verified on commit `354b420667ecdb2bd57359ea73f6350e2460f8f2`; the subsequent release corrects the decorative collection count from six to four and records this evidence. Current running commit is exposed by the health endpoint.

## Observed frontend results

- PASS: original Beaglebyte art renders in the Halloween incubator; four genesis canines, three haunted doorways, and integrated test wallet are visible.
- PASS: funded test wallet retains its identity and balance after deployment/reload.
- PASS: Pumpkin Porch starts one incubation and disables additional door actions until completion.
- PASS: native secret delivery reaches Ready. Open privately displays original PoodlOS Echelon art, `HHHHHHHH`, `CANI-HHHHHHHH-GA`, Red, and the public-reveal warning.
- PASS: closing the preview leaves My canines at zero; reopening shows the identical canine and genotype.
- PASS: Reveal & mint NFT completes and opens My canines with exactly one PoodlOS Echelon NFT.
- PASS: NFT details show all eight H gene positions, generation zero, colour Red and the same genotype as the private preview.
- PASS: reload and reopening My canines retains that one NFT.
- Historical PASS: hosted wallet onboarding/custody text, receiving address, contest rules/links/deadline, insufficient public-faucet explanation, and local 390 × 844 layout were exercised before this artwork release. The current mobile artwork layout needs administrator retest; do not infer it from the earlier desktop pass.

## Developer verification

- PASS: eleven TypeScript tests, including real copied SVG layer/position checks, strict genes/name/colour/genotype metadata parsing, legacy NFT preservation, memo round-trips, journal integrity, browser session isolation and native token address.
- PASS: eight Rust engine tests, including four real genesis mints with exact immutable metadata, fixed-recipient deposit, replay/outsider/altered opening/reseal/early hatch rejection, duplicate reservation and cap, and hidden sealed outcome.
- PASS: release WASM build, TypeScript check and Vite production build. Bundled artwork produces a roughly 313 KB gzip application bundle; Vite emits its advisory chunk-size warning.
- PASS: all 88 original SVG/CSS files match the recorded fetched main-game source revision by SHA-256.
- PASS: v2 template publication and component creation accepted by public Esmeralda; [public receipts](ESMERALDA-DEPLOYMENT.json).
- PASS: real NFT mint accepted (`c54e21dc1f22c4bbe7f2187917e8f1d66c268989d36baa90a183f6c9cbb02372`). Retrying the completed hatch through the game service returns the same receipt and leaves exactly one NFT.
- PASS: the user's original Boo Beagle NFT remains in its account and is returned by the legacy collection reader with its immutable `DDDDBBBB` genes. Missing colour/genotype are not invented. This is a developer inventory check, not a browser pass for that other account.
- NOT RUN: deliberately induced live confirmation timeout. Receipt-preserving completed-hatch retry passed; do not equate that with an interrupted network test.

The public faucet's earlier insufficient balance was bypassed by the user's testnet funding. New browser accounts still require test coins. No contest announcement or submission was sent.

## Frontend acceptance handoff

Prerequisite: developer provides the running app with funded Esmeralda player/operator accounts and a deployed incubator. The administrator only needs a browser.

1. Open the app. Expect Halloween artwork, testnet label and three named doors; on a phone, cards should stack without horizontal scrolling.
2. Open Spooky Secrets. Expect the secret’s purpose, what becomes public, operator trust limits, official links and 1 November 2026 00:00 UTC cutoff.
3. Connect the test wallet. Expect a connected state. If the setup warning is visible, mark the remaining gameplay cases **Blocked: funded deployment unavailable**.
4. Knock once. Expect one incubation progressing; additional door buttons should remain disabled until it finishes.
5. Open the delivered secret. Expect a private canine preview, with an explicit warning that minting publishes its traits.
6. Close the preview. Expect no NFT yet; reopen it and expect the same canine.
7. Choose Reveal & mint NFT. Expect confirmation followed by exactly one canine in My canines, with its original main-game image, name, eight genes, colour and native genotype.
8. Reload. Expect the same NFT. Repeated confirmation/progress checks must not add a second NFT.
9. Disconnect. Expect wallet controls to reset and no private preview remaining visible.

Report: case number, **Pass / Fail / Blocked**, actual visible result, browser/device, and screenshot or recording for failures. Do not infer a live pass from source review or local engine tests.

## Funded-account regression coverage — 16 October 2026

Eighteen application tests pass after adding confidential-only account activation, own-wallet destination/amount limits, pending receipt/restart recovery, lost acknowledgement and delayed balance protection, unfunded-account handling, and legacy missing-account reconciliation. Reconciliation tests preserve ID/secret/commitment/history and reject existing chain requests, matching wallet receipts, unfamiliar schemas and unknown lost acknowledgements. Production build passes. Live repair/deployment results are recorded in the Jira handoff after rollout; these automated tests alone do not establish the user's incubation recovered.

Live repair on 16 October 2026: account activation and the original stuck incubation reached Ready on build `35addec936d8559afb7a60c2a0abbdaf13f513cc`. The same secret and commitment were retained; exactly one start receipt was recorded. No NFT was automatically revealed/minted. The subsequent fix also verifies that queued Check progress requests return valid JSON when the backend returns void.
