# Deployment and recovery

Live app: https://tari.staging.arkimals-game.com/

The application runs as its own Docker Compose project. Only the game HTTP port is published, on host loopback behind HTTPS Nginx. Wallet RPC and the checkpoint router are private. Player signing uses Sapient; the separate operator wallet seals outcomes and delivers encrypted memos.

## Release process

The staging workflow tests the application and contracts, builds an immutable image, then transfers a checksummed release to the restricted deployment gateway. The gateway validates the service identity, image, mounts and loopback port before replacing the application. It captures and reads back a complete runtime/data/secret before-image outside the live deployment directory first.

Deployment credentials are GitHub environment secrets, not repository files. The one-time bootstrap provisions a restricted deployment key and a narrowly scoped Nginx reload helper. The supplied deployment files describe the existing staging installation; operators must review host-specific paths before adapting them elsewhere.

Verify the public health endpoint reports the intended commit and wallet readiness. Then check the browser, artwork and wallet flow separately. HTTP health is not evidence of a successful player transaction. See [dedicated hostnames](STAGING-HOSTNAMES.md) for TLS provisioning and renewal.

## State and keys

The persistent data directory contains wallet data, deployment descriptors and append-only journals. A separate protected secret directory contains wallet encryption material and retained legacy session credentials. They are not part of the image or public source.

Keep both wallet data and its encryption material. Never replace an encryption password as a workaround. Preserve legacy hosted accounts and journals for asset recovery even though their public login/signing routes have been retired.

Before any restoration or manual reconciliation, capture and verify the complete current state outside the target. Preserve identifiers, types, ownership, permissions and later transactions. Use the deployment recovery manifest to select the exact prior image/state; never restore old wallet data merely to roll back source code.

## Network and transactions

Use Esmeralda test coins. The operator requires delivery fees and contract-publication funds; players approve their own game and network fees in Sapient. Faucet availability is external to this application.

The [checkpoint router](INDEXER-RECOVERY.md) selects the furthest verified-data source without replaying failed submissions. Saved transaction IDs and incubation commitments remain durable. An uncertain submission is reconciled against its existing receipt, not assumed safe to repeat. New paid incubations check delivery readiness before requesting player approval.
