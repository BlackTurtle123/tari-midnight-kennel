# Staging deployment

Target: `https://staging.wavesducks.com/tari/`, on verified host `arkimals-c` / `217.100.219.253`. The existing Waves application and Mongo Compose projects remain separate. The PoC has its own `tari-midnight-kennel` project and publishes only `127.0.0.1:18787` to the host proxy.

## Current status

The deployment image pins both public Esmeralda indexers explicitly and checks a live indexer read before reporting wallet readiness. It runs successfully in a local container with the real Esmeralda wallet daemon. Hosted session tests pass, and two real browser identities create distinct wallet accounts and reconnect consistently. The browser funding button reaches the public faucet and reports its insufficient balance. Host SSH access works as `bram`, UID/GID 1001. Adding the host proxy route and restricted deployment credentials requires approved staging sudo access; that credential is not available in the known staging configuration. **This is prepared for deployment, not yet a deployed staging URL.**

No existing staging services or configuration have been changed by this preparation. The deployment workflow stays disabled until `STAGING_ENABLED=true` is deliberately configured after bootstrap.

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

Bootstrap before-images: `/var/backups/arkimals/tari-midnight-kennel-bootstrap/<timestamp>`. Deployment snapshots: `/home/bram/tari-midnight-kennel-recovery/<timestamp>`. App state: `/home/bram/tari-midnight-kennel/data`; encryption and session keys: sibling `secrets` directory, mode 0700 with 0600 files. All are private and excluded from the repository.

Preserve the full wallet database **and its encryption password**. Never rotate the password by replacing the file; that would make the existing wallet unreadable. Before restoration or manual reconciliation, capture and verify the complete current state separately. Restore only the intended cohort and record the exact previous image/commit; never overwrite newer records merely to roll back application code.
