# Privacy, trust and failure boundaries

## Protocol

1. Player signs `begin_incubation(id, recipient, door)`. The contract binds the transaction signer and fixed recipient, reserving one supply slot.
2. Operator samples one of four current-genesis variants with Node’s CSPRNG and a fresh 32-byte salt. Its local journal persists the complete opening before submission.
3. Operator signs `seal_incubation(id, commitment)`. The commitment is SHA-256 of UTF-8 `midnight-kennel:v2|<32 lowercase hex id>|<decimal variant>|<64 lowercase hex salt>`. Once sealed, it cannot be changed.
4. Operator uses walletd `stealthTransfer` to send one microtari with the native encrypted memo `MK2:<id>:<variant>:<salt>` to the player’s payment address. The memo is 103 bytes, below the documented 255-byte limit. Native wallet code performs encryption; this app does not invent cryptography.
5. Private preview reads only on-chain stealth UTXOs decrypted by the selected player wallet and verifies the opening against the commitment. It never falls back to the operator journal’s plaintext.
6. Player signs `hatch(id, variant, salt)`, deliberately publishing the opening. The template verifies signer, commitment, one-time claim and fixed recipient before minting and depositing atomically.

## Who knows what

| Observer                                 | Before hatch                                                                                                     | After hatch                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Public ledger reader                     | Signer/recipient, chosen door, commitment, timing and transaction graph can be public; memo content is encrypted | Opening, canine traits and NFT ownership are public |
| Operator                                 | Variant and salt, player address and all local journal records                                                   | Same, plus public NFT                               |
| Player wallet                            | Decrypts its delivered opening                                                                                   | Owns NFT in the fixed recipient account             |
| Someone with the host/daemon access | Can potentially access both operator and player data                                                             | Same                                                |

Local mode uses operator and player accounts in one development daemon. Hosted staging provisions one player account per signed browser identity, with Secure/HttpOnly/SameSite cookies, origin/host checks and mutation headers. The operator queue and append-only journal are shared. For the existing hosted-wallet path, the staging server still holds its wallet keys and knows every opening: browser isolation does not provide privacy from the operator or self-custody. Disconnect clears the active session while a private identity cookie permits reconnecting to the same test account. Clearing cookies loses that access. No wallet keys, openings or deployment data belong in Git.

The wallet RPC always remains on loopback. Only the game API is published through the configured HTTPS staging proxy. The hosted session secret and wallet encryption password persist outside the image and must be included in protected recovery captures. Staging accounts hold testnet coins only.

## External player wallets

Sapient signs player transactions in the extension. The game server never receives its seed or private/view keys. Opening privately requests revocable wallet view access and a scan for the specific delivery transaction; the browser checks the memo against the on-chain commitment. This permission can expose private wallet balances and memos to this site, so it is requested only on the explicit Open privately action. The operator still knows the surprise and retains its own server signing wallet.

An external incubation ID commits to network, game component, player component, complete payment address (including its view key), door and a random nonce. The player signs that ID in begin_incubation. The server checks this binding, the on-chain signer and built-in account ownership before sealing or delivery. Merely knowing an account address never authorizes a new delivery destination. Existing hosted-wallet IDs and records remain unchanged. See [the exact binding and recovery rules](EXTERNAL-WALLET.md).

## Limits

- Commitment binding prevents changes **after sealing**, not biased operator selection before sealing. The operator can withhold delivery. No fairness claim, odds-based financial prize or yield product is offered.
- Reservations do not expire. A malicious signer can reserve slots; per-signer limits do not prevent Sybil abuse. The capped event is a developer PoC, not a public-sale design.
- There is no cancellation, recovery contract, fee subsidy guarantee or automatic operator failover.
- Transfers use native stealth confidentiality but no promise of unlinkability: fees, revealed funding, graph and timing still expose relationships.
- Losing wallet keys or the operator journal can strand unfinished incubations. Transaction receipt loss stops automatic retries for manual reconciliation.
- NFT transfer/breeding and metadata evolution are outside this PoC’s UI. Metadata is immutable here; minting is restricted to the game component.

Sources: [Tari privacy](https://ootle.tari.com/concepts/privacy/), [resource guide](https://ootle.tari.com/guides/resources/), [randomness limitations](https://ootle.tari.com/guides/randomness/). The live staging encrypted memo, private preview and real NFT mint have been verified; see VALIDATION.md.
