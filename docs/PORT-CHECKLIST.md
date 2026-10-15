# Full-game Tari port checklist

This is the broader port plan. Midnight Kennel validates a narrow slice: incubation, NFT creation, ownership, secret delivery and presentation. It does **not** claim the full Waves game has been ported. Exact parity must be reconciled against the current product inventory before estimating the full migration.

Legend: **Implemented/local** means source exists and relevant local checks passed, not live deployment. **Pending live** requires Esmeralda evidence. Unchecked work is outside this PoC.

| Workstream      | Required functionality                                                                                                    | Coverage in this PoC                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Wallets         | Connect, identity, signing, balances, network checks, fees, rejection and timeout handling                                | Dedicated local test wallet; remote user wallet integration deferred                |
| NFT resource    | Unique ID, mint permissions, immutable traits, genes, generation, lineage schema, supply limits                           | Implemented/local; parents empty for generation zero; pending live                  |
| Incubation      | Request/reservation, owner binding, outcome, one-time hatch, atomic deposit                                               | Implemented/local; pending live                                                     |
| Secret delivery | Native encrypted memo, private preview, commitment verification, explicit reveal                                          | Implemented; public testnet round-trip pending                                      |
| Collection      | Read actual owned NFTs, trait artwork, NFT details, refresh after confirmation                                            | Implemented; populated inventory pending live                                       |
| Breeding        | Own both parents, compatibility, genetics/inheritance, generation, lineage, cooldowns, limits, fees, outcome verification | Deferred                                                                            |
| Transfers       | Send/receive, ownership refresh, listing/breeding locks and concurrent-state conflicts                                    | Deferred                                                                            |
| Treasury        | Account/vault ownership, deposits/withdrawals, accounting, rewards, authority and limits                                  | Deferred; requires a new economic design                                            |
| Yield           | Identify sustainable Tari-compatible reward source and liabilities                                                        | Deferred; Waves leasing income cannot be assumed to port                            |
| Economy         | Gameplay currency, issuance/burn, sinks, pricing, emission caps, claims, precision                                        | Deferred                                                                            |
| Marketplace     | Listings, bids/offers, escrow, purchase/cancel, royalties/fees, transfers                                                 | Deferred                                                                            |
| Game activities | Current game modes, progression, cooldowns, equipment/wearables, consumables, achievements                                | Inventory and redesign pending                                                      |
| Events          | Eligibility, caps, timing, anti-abuse, outcome rules, NFT rewards                                                         | Halloween doors and cosmetic outcomes only; no Sybil protection                     |
| Accounts/social | Profiles, names, preferences, achievements, leaderboards and referrals                                                    | Deferred                                                                            |
| Chain/backend   | Event indexing, reorg/finality policy, pagination, concurrency, reconciliations, historical records                       | Local journal + wallet NFT reads only                                               |
| Assets          | Full canine art/gene composition, metadata hosting, schema versioning and IP rights                                       | Six new SVG canines; no old art migration                                           |
| Waves migration | Snapshot cutover, provenance, eligibility proof, double-claim prevention, old/new ID mapping and rollback                 | Deferred; no live user data modified                                                |
| Operations      | CI, deploys, monitoring, alerts, backups, restore drill, secrets, upgrades and emergency controls                         | Basic CI/deploy scripts; production operations deferred                             |
| Security        | Authorization, replay/reentrancy checks, resource permissions, key rotation, randomness, economic attacks                 | Selected local contract tests; full audit deferred                                  |
| UI              | Wallet onboarding, incubation, breeding, collection, marketplace, treasury, accessibility, mobile/error states            | Incubation/collection/privacy UI; browser checks limited to available prerequisites |
| Launch          | Public testnet acceptance, source/license, documentation, support, production readiness                                   | Pending live and submission steps                                                   |

## PoC acceptance gate

- [x] Real Tari engine creates an NFT in the fixed recipient vault.
- [x] Duplicate hatch, wrong signer, changed opening and repeated commitment are rejected locally.
- [x] UI contains the Halloween theme, secret/privacy explanation and sourced event rules.
- [ ] Publish template and component on Esmeralda; save accepted receipts.
- [ ] Prove native encrypted delivery and owner-only private preview on that deployment.
- [ ] Hatch through the UI, then reload and find the same real NFT in the account.
- [ ] Exercise confirmation timeout and retry against live receipts without minting twice.
- [ ] Complete entrant eligibility, payment address, social announcement and forum submission.

Only after those live gates pass should incubation be marked validated for a full-game Tari port. Breeding and treasury remain independent projects.
