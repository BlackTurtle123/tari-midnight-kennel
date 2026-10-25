# Security

This is an Esmeralda testnet application, not an independently audited mainnet product. Do not use valuable wallets or funds.

## Reporting

Use [GitHub private vulnerability reporting](https://github.com/BlackTurtle123/tari-midnight-kennel/security/advisories/new) if available, or contact the repository owner privately before sharing exploit details. Never attach seed phrases, keys, authentication tokens, wallet databases or private memo openings to a public issue. Public transaction IDs and a minimal reproduction with a disposable test wallet are sufficient starting points.

## Trust model

- Sapient holds player keys and signs player actions. Viewing permission can expose private wallet data to the site; revoke it in Sapient when no longer needed.
- The game operator knows the surprise and keeps its opening in a protected journal. A compromised operator host can expose these openings or interrupt delivery.
- Commitments prevent changing a sealed result; they do not prove unbiased selection. Paid reservations have no automatic refund guarantee.
- Public account activity, NFT holdings and transaction metadata are not anonymous. NFT traits become public at reveal.
- Public resume calls can advance only an existing bound operation. They cannot select a new recipient or supply a signing key. Host/origin checks are browser protections, not authentication against arbitrary HTTP clients.
- Wallet RPC stays on loopback. Production operators must preserve encrypted wallet data, encryption material and journals, and limit access to deployment credentials.

See [privacy](docs/PRIVACY.md), [recovery](docs/INDEXER-RECOVERY.md) and the dated [review findings](docs/SECURITY-REVIEW.md).

## Prevent accidental publication

Keep credentials and runtime data outside the checkout. Git and Docker exclusions cover common key/database/journal paths; exclusions are a guardrail, not proof that a file is safe. Scan both current files and Git history before publishing. If a real credential leaks, revoke/rotate it first; deleting the latest file does not remove history or existing copies. Never rewrite public history without coordinating a recovery plan.
