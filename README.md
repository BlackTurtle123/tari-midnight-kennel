# Arkimals Halloween on Tari

**Hatch a little mischief. Keep the surprise secret until you choose to reveal it.**

[Play on Esmeralda](https://tari.staging.arkimals-game.com/) · [How privacy works](docs/PRIVACY.md) · [Contest entry](docs/CONTEST.md) · [Security](SECURITY.md)

Arkimals is a Halloween canine game built for Tari Ootle’s October 2026 **Spooky Secrets** contest. Choose a haunted doorstep, receive your surprise through a native encrypted Tari memo, preview it privately in Sapient, and decide when to reveal and mint your canine NFT.

## The secret

1. **Reserve:** approve one incubation in Sapient. The deployed game charges 20 test tTARI into its delivery treasury, plus network fees.
2. **Receive:** the game commits to a randomly selected canine and a fresh 256-bit salt, then sends the opening in an encrypted stealth memo.
3. **Peek:** grant wallet viewing permission to decrypt the memo. The browser checks that it matches the on-chain commitment.
4. **Reveal:** explicitly approve minting. The contract checks the signer, commitment and fixed recipient, and permits only one hatch.

Closing the private preview does not mint an NFT. Checking progress follows the saved transaction; it does not authorize another payment.

The operator knows the surprise and can delay delivery. Account activity, timing and fees can be public; revealing publishes the traits. This demonstrates **confidential delivery and a voluntary reveal**, not anonymous gameplay or trustless randomness. [Read the privacy boundaries](docs/PRIVACY.md).

## Explore your pack

- Four genesis canines with eight-position genomes and modular artwork.
- Breeding, with parent selection and inherited genes.
- Halloween rebirth into one of six collectible creatures.
- Shared staking rewards from completed rebirth fees.
- Wallet-held and staked canines together in My pack, with genes and fertility labels.
- Public collections and rankings.

This is an Esmeralda testnet game. Use Sapient with test coins. Wallet keys stay in the extension; private viewing requests revocable access to wallet data. The operator runs a separate delivery wallet.

## Run locally

Requirements: Node.js 22.15+, npm, Rust with `wasm32-unknown-unknown`, and Tari walletd v0.47.0. Use a dedicated Esmeralda operator wallet on loopback; never expose its RPC or use a valuable wallet.

```sh
npm ci
npm run build
npm test
npm run contract:test
```

For wallet setup, contract publication and local development, follow [the development guide](docs/DEVELOPMENT.md). A frontend build alone cannot deliver encrypted memos. [Deployment and recovery](docs/STAGING.md) describes the separate operator service and protected persistent state.

## Code and evidence

| Area | Source |
| --- | --- |
| Incubation and reveal contract | [contract/](contract/) |
| Breeding, rebirth, staking and treasury | [breeding-contract/](breeding-contract/), [rebirth-contract/](rebirth-contract/), [staking-contract/](staking-contract/), [treasury-contract/](treasury-contract/) |
| Wallet integration and UI | [src/](src/), [shared/](shared/) |
| Encrypted delivery and recovery | [server/](server/) |
| Public testnet receipts and test boundaries | [Validation](docs/VALIDATION.md) |

The Tari implementation was developed in October 2026. It uses the existing Arkimals visual identity and artwork; these are not claimed as new October artwork. Asset provenance is recorded in [CANINE-ASSETS.json](docs/CANINE-ASSETS.json). Code is [MIT licensed](LICENSE). Dependencies retain their own licenses. See [contest preparation](docs/CONTEST.md) for the entry draft and remaining entrant details.
