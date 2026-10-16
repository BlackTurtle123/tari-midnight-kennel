# Staging deployment

Target: `https://staging.wavesducks.com/tari/`, on verified host `arkimals-c` / `217.100.219.253`. The existing Waves application and Mongo Compose projects remain separate. The PoC has its own `tari-midnight-kennel` project and publishes only `127.0.0.1:18787` to the host proxy.

## Deployment status and verification

**Live:** https://staging.wavesducks.com/tari/. The 15 October 2026 genetics release deploys original main-game art and committed genesis traits. The v2 contract is published and the live browser incubation → native encrypted memo → preview → mint → collection/reload flow passed. See [validation](VALIDATION.md) and [public receipts](ESMERALDA-DEPLOYMENT.json). The exact running application commit is available from `/tari/api/health`.

The user supplied 1,000 tTARI to their browser account. An accepted native stealth transfer allocated 25 tTARI to the operator and revealed 10 tTARI in the same user account; 5 tTARI from the operator funded the separate QA browser account. No mainnet funds were used. The operator can now cover publication, sealing and memo delivery. Fresh browsers still need test coins.

The original NFT resource and wallet database remain intact. The new receipt is `deployment-v2.json`; new incubations use `incubations-v2.jsonl`. The UI also reads the original collection so existing NFTs remain visible.

The host was bootstrapped on 15 October 2026 after approved administrator access became available. Nginx validation passed, original configuration and authorized keys were captured and verified at `/var/backups/arkimals/tari-midnight-kennel-bootstrap/20261015T184158531138Z`, and the dedicated CI environment/key was configured. The first CI build passed, but GitHub’s hosted runner timed out reaching staging TCP22 before authentication. Automatic SSH deployment is paused (`STAGING_ENABLED=false`). The workflow retains a checksummed release artifact for an accessible runner or an explicitly authorized manual deployment. Set `STAGING_RUNNER_JSON` to the approved runner labels before re-enabling automatic deployment; its default is `"ubuntu-latest"`.

For later deployments, check the public health commit and deployment receipts; a successful artifact build alone does not establish deployment. The first run was https://github.com/BlackTurtle123/tari-midnight-kennel/actions/runs/38787871708; no application container was started by that failed run. Successful deployment verifies the public `/tari/api/health` endpoint against the exact commit. This readiness check includes a live public-indexer read. Public template/component deployment and a real NFT mint have since passed.

The image pins both public Esmeralda indexers. Local container and browser checks confirmed distinct real wallet accounts, reconnect continuity, receiving addresses and the actual insufficient-faucet error before host activation. Original Waves and Mongo services remain in their existing projects.

## One-time administrator bootstrap

1. Generate a dedicated Ed25519 CI key outside the checkout. Keep its private key out of Git and logs.
2. Copy the reviewed `deploy/` scripts and public key into a private temporary directory on staging, using the existing multiplexed administrator connection.
3. With approved host sudo access, run `bootstrap-staging.py --source <deploy-directory> --public-key <public-key-path>`.
4. The bootstrap verifies host and UID, rejects pre-existing or symlinked targets, captures and checks the complete current Nginx configuration and `authorized_keys` outside the live targets, and preserves their owner/mode/ACL metadata. It creates a private wallet directory, persistent random encryption/session keys, a forced-command SSH entry and a narrowly scoped Nginx reload helper. It validates Nginx but does not start/reload services.
5. Configure repository environment `staging` secrets `STAGING_DEPLOY_KEY` and `STAGING_KNOWN_HOSTS`. Use the already verified host key; never disable host-key checking. Set repository variable `STAGING_ENABLED=true` only when the route and gateway are ready.
6. Close the administrator SSH control session before the pipeline opens its one deployment connection. Push the reviewed latest Jira branch commit. The workflow builds/tests on GitHub, transfers a checksummed image artifact, captures existing PoC runtime/data before replacement, starts only this Compose service, then activates Nginx after health passes.
7. Confirm public `/tari/api/health` reports the exact deployed commit and `walletReady: true`; separately check the original staging site and existing service/container health.

The workflow also supports `workflow_dispatch` once the workflow exists on the repository default branch. No image build runs on the staging application/database host. No `--remove-orphans`, shared project names, global prune, permission repair or unrelated container restart is used.

## Hosted test wallets

Each browser receives a separate server-custodied Esmeralda account bound to a signed HttpOnly, Secure, SameSite=Strict cookie under `/tari/`. A persistent identity cookie permits reconnecting after Disconnect; deleting cookies or switching browsers loses that test-account access. Both operator and player keys are held by the staging server. This is a test environment, not a self-custody wallet connection. The API exposes game actions only; the wallet RPC remains on loopback inside the container.

Accounts are capped at 27 per daemon (operator, local development account and up to 25 browser accounts). Mutation requests are rate-limited. Operator calls share one queue and one journal across players. Host/origin and cookie-signature checks prevent unrelated websites and forged account selection. The UI shows each account’s public payment address and balance.

## Testnet funding

The verified faucet balance on 15 October 2026 was **999.651320 tTARI**. Its fixed claim is **1,000 tTARI**, so a claim fails despite a nonzero pool. The shortfall for one claim is 0.348680 tTARI; funding two fresh accounts requires two claims or direct transfers. This is a network funding condition, not a deployment permission error.

Use a funded Esmeralda peer wallet or [Tari’s L1 testnet burn-and-claim process](https://ootle.tari.com/guides/burn-minotari/). The UI’s faucet button reports the network failure without fabricating a balance. No mainnet coins are purchased, burned or transferred by this deployment.

A healthy website/daemon does not mean the NFT template is deployed. Once the operator has test coins, run the contract publication script through an authorized deployment job, preserve the accepted receipts, then fund a player and verify encrypted delivery and minting. The image contains the release WASM for that step.

## Recovery

The initial website snapshot is `/home/bram/tari-midnight-kennel-recovery/20261015T185710746933Z`; the genetics rollout snapshot is `/home/bram/tari-midnight-kennel-recovery/20261015T213405615851Z`. Local artifact provenance and host verification are retained in the private workstation deployment record.

Bootstrap before-images: `/var/backups/arkimals/tari-midnight-kennel-bootstrap/<timestamp>`. Deployment snapshots: `/home/bram/tari-midnight-kennel-recovery/<timestamp>`. App state: `/home/bram/tari-midnight-kennel/data`; encryption and session keys: sibling `secrets` directory, mode 0700 with 0600 files. All are private and excluded from the repository.

Preserve the full wallet database **and its encryption password**. Never rotate the password by replacing the file; that would make the existing wallet unreadable. Before restoration or manual reconciliation, capture and verify the complete current state separately. Restore only the intended cohort and record the exact previous image/commit; never overwrite newer records merely to roll back application code.

## Funded wallet activation (16 October 2026)

Receiving confidential test coins does not necessarily create a Tari account component. Before incubation/hatch the server refreshes the selected wallet's balances and confirms its account exists. When necessary, a dry-run-checked native self-transfer reveals a small fee reserve (3 tTARI for a new incubation, with a 0.05 tTARI activation fee cap), using only that wallet's own coins and returning it to the same payment address. Already-ready accounts skip the transfer. The append-only `account-activation.jsonl` records intent and receipt before subsequent steps; pending confirmations resume the existing receipt and lost acknowledgements stop duplicate transfers.

The pinned walletd's missing-input 404 occurs during input detection before signing/storage/submission. Only that precise structured RPC response is classified as unsubmitted. Transport failures remain ambiguous. Legacy starts with the original missing-account 404 can be recovered only when the full journal history matches, no wallet receipt references the incubation, and the verified game component has no matching request. Recovery appends a new reserved state and retains the same ID, salt and commitment. Hosted startup retries only this narrowly verified failure cohort; other ambiguous submissions still require reconciliation. Deploy through the recovery gateway so complete wallet/journal/secret before-images precede any repair.

Source: [walletd v0.46.1 transaction input detection](https://github.com/tari-project/tari-ootle/blob/v0.46.1/applications/tari_walletd/src/handlers/transaction.rs), [native revealed self-transfer account creation](https://github.com/tari-project/tari-ootle/blob/v0.46.1/crates/wallet/sdk/src/apis/stealth_transfer/api.rs).
