# Checkpoint selection and incubation recovery

On 25 October 2026 the staging wallet selected Tari indexer B. Both public
indexers reported base-layer epoch 12673, but A served the shard-1 checkpoint
ending epoch 12672 and B only served the checkpoint ending epoch 12567. The
wallet trusted validators through epoch 12671 and could not verify state proven
in epoch 12673 using B. Walletd's connection-failure routing did not help because
B continued answering HTTP requests.

The hosted entrypoint now starts a loopback-only indexer router at port 15102.
It compares the two official indexers' latest shard-1 checkpoints and selects
the furthest progressed source, caching the comparison for 15 seconds. It does
not use liveness probes or the base-layer epoch to rank sources. It refuses to
move behind the furthest checkpoint it has observed during that process's
lifetime. Walletd and the game IndexerProvider retain proof verification;
checkpoint ranking is not itself a proof or a replacement for verification.

Each incoming request is forwarded once. Failed submissions are never replayed
by the router. Existing event streams keep their original connection until they
close; subsequent requests use the latest selection. When no source can supply
the observed checkpoint progress, reads fail closed and new paid incubations
fail their verified balance/reserve preflight before player approval.

Walletd 0.47 stores a signed transaction before submitting it. A failed RPC
response can therefore leave a transaction in `New` while the application's
seal marker lacks its ID. Recovery matches the exact game, incubation ID,
commitment, signer, fee account and instructions against persisted wallet
transactions. A unique match restores only its ID; zero or multiple matches
remain blocked. Rejected transaction IDs are retained, never cleared to allow
replacement. A background check follows unfinished incubations every 30 seconds
without rebuilding a submitted transaction. A delivery with an unknown transfer
acknowledgement remains blocked rather than guessing which encrypted output is
its own.

Walletd itself has an internal queue that broadcasts persisted `New` transactions
using their existing signed transaction/hash. This application does not invoke
that broadcast or build a replacement. Reading a pending result is not evidence
that it is safe to submit again.

Deployment uses the existing gateway's complete, read-back-verified data and
configuration capture before startup migrates walletd's stored indexer URL to
the local router and reconciles incubation records. Subsequent source selection
is in memory and does not rewrite wallet configuration. To roll back, use the
gateway recovery manifest; preserve later transactions and journal changes before
restoring any wallet state. A source-only rollback must also restore the prior
indexer setting, since older entrypoints do not provide the local router.

Primary code researched at Tari Ootle tag `v0.47.0`:

- `crates/wallet/sdk/src/apis/validator_set.rs`: checkpoint handover verification.
- `crates/wallet/sdk_services/src/indexer_rest_api.rs`: endpoint selection and connection-failure handling.
- `crates/wallet/sdk_services/src/transaction_service/service.rs`: persistence before submission and the existing signed-transaction queue.
- `applications/tari_walletd/src/lib.rs`: stored endpoints override CLI settings.

Automated checks cover checkpoint ranking/advancement/regression, failed POST
non-replay, exact seal reconciliation, rejected transaction preservation and
paid preflight failure. These do not establish that a player's Sapient wallet
has decrypted its private delivery; that requires a connected-wallet retest.
