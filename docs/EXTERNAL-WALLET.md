# Sapient connection and preservation

Use **Connect wallet → Connect Sapient** in Chrome with [Sapient](https://sapient.tari.mw/) installed. Select Esmeralda and a seed-derived local extension account, fund it with test Tari, and activate its account in Sapient if needed (unshield a small fee reserve). The app refuses mainnet, Igor and daemon-relayed accounts for this path. Every player incubation and mint requires wallet approval, with a maximum fee of 1 tTARI per transaction. The wallet chooses its supported fee mechanism.

Player login is **external-wallet only**. The old staging/local login and all cookie-authenticated player-signing API routes return HTTP 410. Existing cookies are neither used to log in nor cleared. Startup and setup provision only the operator account, never a player account. Public external endpoints do not accept seeds or sign player transactions.

The operator remains hosted and signs seals/encrypted deliveries and scheduled draw capture. Existing hosted player wallets, keys, session signing key, cookies and journals remain preserved for controlled recovery; removing the login does not migrate their assets to Sapient. Pending legacy incubations still require their original signer. Contact the operator for an explicit, independently verified recovery/transfer if assets remain there. Never import the shared hosted master seed into a player's extension: it could expose other players and the operator. No recovery or asset transfer happens automatically.

## Protocol binding

Before requesting a signature, the browser saves a public recovery intent containing the network, deployed game component, player component, complete Esmeralda payment address, chosen door and 32 random nonce bytes. The ID is the first 16 bytes of SHA-256 over UTF-8 JSON encoding of:

```text
["midnight-kennel:external:v1", "esmeralda", component, account, paymentAddress, door, lowercaseHexNonce]
```

The player signs this ID in `begin_incubation`. The server checks the ID, chain signer/recipient/door, built-in account owner and address network before generating a secret. This binds both the address owner key and view key; matching only an owner public key would permit substitution of an attacker's view key. IDs have 128-bit preimage resistance. The existing deployed contract and old hosted IDs are unchanged.

External records use a separate append-only `external-wallets/incubations-v2.jsonl` under the data directory. All operator writes share the same queue and account-activation recovery store used by the operator. Public endpoints cannot return openings, change recipients or sign player operations. Public holdings come from account vault membership and canonical NFT substates, not an assumption that the original recipient still owns every minted NFT.

## Approvals, private preview and recovery

The adapter implements Sapient's [durable transaction-request API](https://github.com/chironbuilds/tari-wallet/blob/master/docs/integration/transaction-requests.md). Request IDs are saved before submission. Reload/reconnect resumes those IDs; uncertain creation/submission acknowledgements never create another transaction automatically. A confirmed user rejection can be requested again on the next explicit action. Failed/unknown submissions require reconciliation. Web Locks prevent concurrent requests from two tabs in the same browser.

Browser storage contains append-only public intents and approval IDs, never wallet secrets or decrypted openings. Clearing that storage before initial registration loses the address-binding nonce needed for automatic delivery recovery. Keep browser data until delivery is registered. After server registration, reconnecting the same Sapient account from another browser can read its delivery and hatch. If a transaction acknowledgement is lost, preserve storage and inspect the original wallet request and on-chain incubation before any manual repair. No reset/delete button exists.

Only **Open privately** requests wallet view permission. This grant can expose private wallet balances/memos to the site and is revocable in Sapient. The app performs a scan scoped to its specific encrypted-delivery transaction, verifies the opening hash locally, and retains the preview only in memory. **Keep it secret for now** publishes nothing. **Make public & mint NFT** asks the wallet to sign the reveal; the salt and traits then become public. Account/network changes close the private preview and invalidate the connection.

## Preservation and verification

Before deployment, the gateway captures and reads back complete `data` and `secrets` archives outside the live deployment, validating file counts, hashes, ownership, permissions and extended attributes. Preserve the wallet database/keystore, wallet encryption password configuration, session signing key, deployment descriptors, account-activation records, hosted journals and external journals together. Retain previous images and recovery manifests; restore only after separately preserving and reconciling later writes.

Adapter API research: Sapient 0.6.6 source at `7ad3c4f117a76c64d472fd371b7d75bbe297abec`. Integration calls its public API; no wallet implementation code was copied. Automated checks cover instruction compatibility with Tari's SDK, address/view-key binding, public-record secrecy, interrupted requests, repeated mint, network invalidation and no server player provisioning. Read-only live Esmeralda checks validate the component parser, account binding and existing NFT holdings.

**Pending manual acceptance:** complete connect → wallet-approved begin → delivered private memo → wallet-approved mint using a funded Sapient installation. Simulated provider tests do not establish that live extension flow. Keep the existing wallet path available throughout acceptance.
