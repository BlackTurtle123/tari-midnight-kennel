# Tari implementation scope

This repository implements the Tari game and private incubation experience. It does not migrate Waves NFTs or reproduce every mechanic of the original Arkimals economy.

| Area | Current implementation |
| --- | --- |
| Wallet | Sapient account connection, signing and explicitly requested private viewing |
| Incubation | Fixed-recipient reservation, 20 test tTARI treasury contribution, commitment and one-time hatch |
| Secret delivery | Native encrypted memo; browser verifies the opening before preview |
| Collection | Wallet-held/staked canines, genes, fertility and public rankings |
| Breeding | Parent validation, inherited genes, future epoch draw and offspring |
| Rebirth | Six Halloween outcomes and shared staking fee distribution |
| Recovery | Append-only journals, saved receipt reconciliation and checkpoint selection |
| Assets | Existing Arkimals modular artwork with recorded provenance |

Marketplace, Waves asset migration, perches, consumable items, native leasing income and full main-game economic parity are outside this implementation. The engineering comparison is in [FULL-FLOW-RULES.md](FULL-FLOW-RULES.md), not a list of playable features.

See [validation](VALIDATION.md) for observed evidence and [security](../SECURITY.md) for trust and operational limits.
