# TLK-1557 — main-game rule port and activation gates

Source: the four deployed canine Ride contracts and their shared oracle, captured read-only on 20 October 2026. The checked-in historical Ride incubator differs from the live one. `main-game-rules/manifest.json` identifies the source addresses, node and SHA-256 hashes; the complete public scripts, decompilation and selected oracle entries are preserved alongside it. Main frontend reference: origin/master `1a3a040e06f5043072f567d8f01ed21cbc00d003`.

This is a production-target rule inventory, **not a production-readiness certification**. Existing immutable Tari contracts retain their rules, NFT resources, stakes and pending requests. No keys, wallet records, or saved approvals are removed.

## Delivered in this change

- [x] Separate Rebirth and Staking pages, with navigable hash URLs and browser history.
- [x] Breeding page, parent eligibility, generation preview, explicit wallet review, durable approval recovery and fixed-recipient completion.
- [x] New breeding template: exact fee escrow, immutable collection allowlist, two real NFT buckets, eight independent 50/50 inherited genes, uniform A–D colour, generation advancement, parents returned with offspring, one completed breeding per parent across transfers.
- [x] Generation order G,H,I,K,L,M,N,O; O cannot breed. G+I creates K. No shared-parent or inbreeding prohibition exists in the source; do not invent one.
- [x] Future epoch +2 draw with permissionless capture, no transaction-nonce reroll, no owner-selected outcome; owner-only recovery of parents and full game fee if the target epoch was missed. Network fees are never refunded. A missed exact pair cannot repeat its attempt, while its parents can pair elsewhere.
- [x] Bred offspring can breed again under the same template. Genome renderer supports all eight main-game genes and mixed inheritance.
- [x] Exact reference implementations of supply-based incubation price, rarity grouping and FP integer arithmetic, with regression tests.
- [x] Main-game rules and current release differences visible in the app.
- [x] Staging activation path authorized: 1 native test tTARI breeding fee, treasury funded; no EGG equivalence. Deployment is append-only with explicit descriptors and receipt reconciliation.
- [x] One shared staking component and one active rebirth component accept incubated, legacy and bred canine resources. Earlier components are recovery-only in the app: preserve withdrawals, claims, pending draws and saved approvals. Never create a collection-specific pool. This corrects pool topology; production FP/perch/item and leasing parity remain pending.

## Shared-farm staging transition

After deploying the tested application and template binaries, run `npm run deploy:unified-economy` once with the existing operator wallet. It creates `staking-unified-v2.json` and `rebirth-unified-v2.json` with independent durable publication journals; existing descriptors are never replaced. Re-running preserves completed deployments and refuses ambiguous submissions until receipts are reconciled.

The application activates the shared farm only when the complete rebirth descriptor validates against all three canine collections. Previous pools remain available through “Move your existing stakes”: owners withdraw their canine and earned rewards, then approve a stake in the shared farm. Pending old rebirths retain their original draw, fee recipient and recovery actions. Their epoch keepers and saved wallet approvals continue to work. Previously minted Halloween NFTs stay in inventory. An old pool can still receive a fee from its already-started rebirth; it is not offered for new deposits in the app.

This is a voluntary contract transition, not an automatic movement of player assets. The engine regression stakes an incubated parent and a bred child in the same component, completes a bred canine rebirth, and verifies both positions claim half of the funded 75% reward share.

## Incubation

- [ ] Replace free MVP issuance with an on-chain price and supply policy.
- Live genesis is one of E/F/G/H, generation G, colour A/B/C/D. Special item issuance can use A–H; it is not an unlimited public mint.
- Live coefficient = 10. Price in wavelets: `(floor(sqrt((100 + floor(n*g/30))*100)) + 55) * 1,500,000`. `n` is cumulative started issuance; it does not decrease on rebirth. At n=0: 2.325 WAVES. At captured n=6132: 7.77 WAVES. These are reference-game prices, not TARI conversion rates.
- Native incubation receipts route 75% to leasing principal and 25% treasury in the main game. Coupon ART-CANCPN can reduce price 15%; validate item ownership and exact source consumption semantics before porting.
- Main game adds a separate 0.01 WAVES service fee to applicable actions; Tari network fees are separate and should not be silently equated with this.
- [ ] Define Tari pricing denomination/coefficient, caps, fee recipients, and a signed configuration version.
- [ ] Retain encrypted private preview as the contest experience while removing discretionary outcome selection. On-chain commitment verification alone proves consistency, not unbiased operator randomness.
- [ ] Pin legacy eligibility at a verified cutover. Hiding the old free mint in the UI cannot disable its immutable contract or establish scarce production supply.

## Breeding dependencies

- Main price: 1 EGG (100000000 units). Optional coupon balance reduces payment. Valid referral gets 5%; the remaining EGG is burned. Tari cannot burn EGG it has not issued.
- [x] Native test TARI treasury fee chosen for staging activation; EGG-like burn economics are not claimed. Deployment script supports a bounded configurable staging fee; no automatic currency-equivalence claim.
- [ ] Fixed-gene item: choose one parent/position, verify ownership, consume atomically at completion.
- [ ] Free-gene item: inject a random A/B/C gene at a random position, consume atomically.
- [ ] Mirror item: reject G/J/O, copy genes/generation and breeding-use state, consume item.
- [ ] Coupons/referrals: authenticated claimant, fixed recipients, replay prevention, exact rounding, and actual fee token.

## Farming

- [ ] Colour-matching perches: buy at 3 EGG, optional coupon/referral handling, 10% ART-XMISTL ownership discount, consume capacity on stake and restore capacity to the original perch owner on unstake. Jackpot U chooses a valid colour.
- Gene power = floor(100 * 1.5^distinctGenes); jackpot U uses 8. Group key sorts counts of A–H and appends generation, ignoring gene order and colour.
- Main age multiplier = floor((Waves height - baseBlock)*100/129600), with baseBlock3750000 on production (2500000 in test mode). Cache positive basePower at first stake; preserve it after unstake.
- Rarity = floor(sqrt(floor(10000/groupQuantity))), falling back to 2 if the result is zero; jackpot rarity is100.
- rarePower = floor(basePower*rarity/100). FP = rarePower + floor(rarePower*itemBoost/100) + floor(rarePower*wearableBoost/1000).
- [ ] A canonical cross-incubator/breeder/rebirth rarity registry must count live eligible supply, not only deposited/staked tokens or browser inventory.
- [ ] Choose the Tari time/epoch origin and progression for base power; WAVES height cannot be used as an Ootle consensus input without an oracle.
- [ ] On-chain FP-weighted reward index, first-stake cache, settlement before weight changes, safe zero-FP handling, per-position fractional carry and funded solvency.
- [ ] Claims settle at previous FP, then recalculate weights using current rarity/boosts, following the main game's lifecycle. Never retroactively award newly added FP for past income.
- [x] Old equal-share positions retain claim/unstake and incoming fees promised by already-started rebirths. Voluntary migration only; no fabricated stakes or automated custody transfer.
- [ ] Funded source decision: main game leases WAVES principal. Actual incoming income pays mutants5%, then team1/12 of remainder, then halves remaining income into compounding and farmer payout. Ootle validator PoS is not a plug-in replacement for WAVES leasing.

## Rebirth and event rewards

- Main price8WAVES;75% leasing principal/25%treasury at start. Existing Tari release instead escrows8tTARI and splits75/25 only on successful mint. Preserve this distinction for pending requests.
- Base table (weights /1000): perch A/B/C/D100each; duck incubator50; ducklings40/20 weights40/50; feed5/10/15/20/25/50/100 weights100/70/30/30/20/20/20; green/dark mutarium30each; free/fix gene20each; turtle incubator50; potion20. Total1000.
- Captured event configuration adds ART-H26SOUL at40%, start1792080000000ms, end1794762000000ms. It is a bonus, not a replacement of the base table. Source supports one or two bonus item codes and time-bounded chance.
- [ ] Mint genuine usable item NFTs, perches, and species incubators before enabling the corresponding base outcomes. A picture with no promised effect is not parity.
- [ ] Double reward item ART-GIFT_DOUBL; excluded outcome ART-HWERASE;50% canine rescue ART-HWRESCUE; ownership, burn/consumption, atomic effects, rarity restoration on rescue.
- [ ] Decide event editions vs full species game dependencies. Existing Tari Cat/Shadowfang/Mummy/Ghosty/Pumpkin/Soul six-outcome draw remains its own immutable event edition. Do not change pending draws' odds.

## Readiness and release gates

- [ ] Resolve economy denomination, source, timing and the dependency scope with the owner.
- [ ] Capture complete verified runtime before-images before any descriptor/cutover migration. Deploy versioned components; preserve every original recovery path.
- [ ] Complete bounded-capacity/state growth design; current breeding template is capped at1000 attempts and stored in component maps, not an unlimited production deployment.
- [ ] Test supply/price boundaries, exact payouts, total reward solvency, cap exhaustion, generation O, all item consumption/failure rollbacks, transfers and legacy migration.
- [ ] Independent contract review and network-specific liveness/load tests; resilient epoch capture with alerting and sufficient operator fee reserves. Missed epoch refunds are a liveness fallback, not proof of bias-free selective-abort resistance.
- [ ] End-to-end Sapient browser acceptance with funded operator test assets, including retry/reconnect, all custody transitions and final wallet inventory. Do not use player funds for smoke tests.
- [x] Every admitted canine resource supports breeding, staking and the Halloween rebirth edition. Existing pool contracts remain accessible.
- [ ] Explicit mainnet configuration and deployment. The current request's staging work does not authorize a production-host or mainnet release.
