# Full-game Tari port checklist

This is the broader port plan. Midnight Kennel validates a narrow slice: incubation, NFT creation, ownership, secret delivery and presentation. It does **not** claim the full Waves game has been ported. Exact parity must be reconciled against the current product inventory before estimating the full migration.

Legend: **Implemented/local** means source exists and relevant local checks passed, not live deployment. **Pending live** requires Esmeralda evidence. Unchecked work is outside this PoC.

| Workstream      | Required functionality                                                                                                    | Coverage in this PoC                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Wallets         | Connect, identity, signing, balances, network checks, fees, rejection and timeout handling                                | Integrated server-custodied browser test wallets validated; self-custody deferred                |
| NFT resource    | Unique ID, mint permissions, immutable traits, genes, generation, lineage schema, supply limits                           | Validated live; original artwork/genesis genes; parents empty for generation zero                  |
| Incubation      | Request/reservation, owner binding, outcome, one-time hatch, atomic deposit                                               | Validated live                                                     |
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
| Launch          | Public testnet acceptance, source/license, documentation, support, production readiness                                   | Core incubation validated live; contest submission remains                                                   |

## Existing game feature families to reconcile

A read-only inventory of the current Waves contract tree identifies these additional parity decisions. These are requirements to assess, not source copied into the new contest entry. Presence in the repository does not establish that a feature is active in production.

- [ ] **Canine incubation:** fees and fee aggregation, discounts/coupons/referrals, finish-height timing, rarity adjustment, free issuance and jackpot issuance. The PoC intentionally covers only request → secret → one NFT.
- [x] **Minimal Halloween rebirth primitive:** actual NFT withdrawal, irreversible retirement, selected reward mint and atomic deposit in a separate Tari component. Both existing canine collections supported. Engine-tested; live player approval acceptance is separate. The main-game probabilistic loot/economy is not ported.
- [ ] **Canine progression:** breeding, farming/staking, boosted stake/claim flows, rebirth, and the node/treasury contract. Replace each Waves-dependent economic assumption explicitly.
- [ ] **Other species:** ducks, eagles, felines, bulls, turtles and mutants; decide which incubation, breeding, rebirth and staking variants belong in the Tari release.
- [ ] **Duck-specific progression:** baby ducks, baby breeding, farming generations and vEGG farming.
- [ ] **Collective farms:** participation/shares, staking, secondary layers, liquidation and AMM interactions.
- [ ] **Hunt and battles:** hunt, level system, capacity, rope, renting and Duck Wars, including rewards and concurrent-use locks.
- [ ] **Items and equipment:** wearable boosts, account boosters, houses/multiple houses, item stores/mergers and seasonal item issuance.
- [ ] **Economy services:** egg dispenser, burn rules, coupons and referrals; enumerate currencies, precision, price sources and liabilities.
- [ ] **Trading and cross-chain:** marketplace/proxy, action wrappers, bridge wrappers, Ethereum gateway and wrapped NFT issuance. Decide what to remove, replace or migrate; never infer Tari interoperability from existing Waves code.
- [ ] **Administration:** oracle configuration, signer/multisig authority, feature locks, operational recovery and network-specific configuration.

This inventory makes the full-game checklist broader than the contest mini-game. Each selected family needs product rules, a Tari implementation, migration policy, UI and independent acceptance evidence before being considered ported.

## PoC acceptance gate

- [x] Real Tari engine creates an NFT in the fixed recipient vault.
- [x] Duplicate hatch, wrong signer, changed opening and repeated commitment are rejected locally.
- [x] UI contains the Halloween theme, secret/privacy explanation and sourced event rules.
- [x] Publish template and component on Esmeralda; save accepted receipts.
- [x] Prove native encrypted delivery and owner-only private preview on that deployment.
- [x] Hatch through the UI, then reload and find the same real NFT in the account.
- [ ] Exercise confirmation timeout and retry against live receipts without minting twice.
- [ ] Complete entrant eligibility, payment address, social announcement and forum submission.

The core incubation flow is validated on public Esmeralda. Interrupted-network testing and contest submission remain separate open gates. Breeding and treasury remain independent projects.
