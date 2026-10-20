# TLK-1557 — Arkimals Halloween rebirth and staking

The Tari MVP follows the main game's core loop: offer one canine plus a native-token fee, wait, then finish a randomized rebirth. It retains the original 75% staking / 25% treasury fee split. It deliberately uses a smaller Halloween loot table and equal NFT staking shares; main-game farming power, perches, rescue/erase artifacts, doubled rewards and node leasing are not ported.

## Ritual and reward pool

The staging ritual costs **8 testnet tTARI**, separate from network fees. This is a test configuration, not a WAVES/TARI exchange rate. One current or legacy Tari canine and the fee enter escrow. The request fixes its recipient, original token, and draw epoch at current epoch + 2. Completion permanently retires the original NFT in the rebirth contract and atomically deposits one newly minted Halloween NFT into the original recipient account. Original NFT resources are immutable, so retirement is custody with no post-completion withdrawal, not burning.

| Reward | Original art identifier | Draw weight |
| --- | --- | --- |
| Haunted Cat | ART-H26CAT | 30% |
| Shadowfang | CANI-WWWWWOLF-JU | 5% |
| Crest Mummy | EAGL-WWWMUMMY-JU | 5% |
| Ghosty | ART-GHOSTY | 25% |
| Pumpkin Familiar | ART-PUMPKIN | 20% |
| Halloween Soul | ART-H26SOUL | 15% |

These are new Esmeralda testnet collectibles using original Arkimals art. They do not grant main-game item powers, cash prizes or cross-chain claims. Immutable NFT metadata includes original art ID, original canine collection/token and the draw epoch/hash. No feline or item genetics are invented.

## Fixed future draw and recovery

The network's built-in transaction randomness can be ground by varying transaction inputs. This implementation instead fixes a future epoch before its consensus hash is available. A permissionless `capture_epoch` records the consensus hash only while the scheduled epoch is current. The app runs a keeper every 30 seconds; a player finishing during that epoch can also capture it. Captured hashes cannot be replaced. `finish_rebirth` derives SHA-256 from a fixed domain, original NFT-derived request ID and that saved epoch hash. It uses the first 32 bits modulo 100 for the table weights (negligible modulo bias); transaction nonce, finishing time and caller cannot reroll it.

The two-epoch wait is usually around 20–40 minutes and follows the network clock, not a browser countdown. This is future-consensus randomness, not an external VRF or a claim of protection against colluding consensus participants. Capture availability is required: if the scheduled epoch ends uncaptured, only the original transaction signer may recover the canine and the entire ritual fee. Network fees are not refunded. A captured draw cannot be cancelled, even when its outcome is known. Refunded requests are terminal for that source NFT in this event; no later-epoch reroll is offered. No owner/admin can redirect player assets.

The original contest secret remains the encrypted incubation result, privately previewed before revealing and minting. Rebirth is a separate public draw: its result is reproducible once its fixed epoch hash is recorded.

## Staking contract

`staking-contract` is an independent immutable component. It accepts exactly one original Tari canine per stake. Each NFT has one equal share. The original signer controls claim/unstake, and payouts and principal always go to the fixed original recipient. Staked canines cannot simultaneously be transferred or reborn.

At successful rebirth completion, 75% of the ritual fee is deposited into staking and 25% into the fixed treasury account. A cumulative reward-per-share index accrues only actually funded fees. New positions start at the current index and cannot claim earlier distributions. Claims carry fractional microtari forward while staked; unstaking claims whole microtari and returns the NFT atomically. Sub-microtari rounding residue remains in the reward vault; there is no admin sweep. If the pool is empty at fee arrival, that allocation goes to the treasury, not the next staker. Pool funding and claimed totals are public.

This is application-level NFT staking funded by rebirth revenue. It does not turn Ootle into PoS, lease Tari, mint yield, promise an APR or guarantee income. Maximum 250 concurrent stakes and 250 rebirth requests bound this event MVP.

## Wallets and deployment

Sapient is the only player login and signs inside the extension. Append-only public browser recovery records retain the exact action and wallet request ID. Unknown acknowledgements block duplicate requests; known request IDs are resumed. Old hosted player-signing endpoints are retired; account keys, master seed, cookie identities and fsynced journals remain preserved for controlled recovery. Transfers and seed backup are handled inside Sapient. The operator still signs secret delivery and epoch capture; its exact pre-signing checkpoint error can retry safely, while ambiguous errors remain blocked.

Ootle v0.47.0 changed indexer response shapes and requires the matching wallet daemon. The app pins that daemon by published SHA-256 and uses the compatible SDK. It rejects unverified or spent indexer responses. The wallet's verified-read mode remains enabled.

Build both new crates and copy their WASMs into `deploy/artifacts`. Deploy the app through the verified manual staging gateway. Capture and verify a complete wallet before-image before any publication. `npm run deploy:economy` publishes/creates staking first, then rebirth, using only bounded operator test funds. Submission markers are fsynced before calls, and deployment descriptors are created exclusively as `staking-v1.json` and `rebirth-v1.json`. Existing incubation deployments and journals are not replaced.

Engine tests cover the paid sacrifice, rejected fee rollback, fixed epoch, duplicate completion, captured-draw cancellation rejection, missed-epoch refund, unauthorized staking withdrawal, no historical rewards for late stakers, payout split and principal return. Simulated browser acceptance is distinct from a live player transaction. Never sacrifice a player's NFT merely to smoke-test deployment.

## Artwork provenance

Source: `BlackTurtle123/wavesducks`, local `wavesducks-portal-TLK-1549`. The logo is `public/img/branding/logo-text.svg`. Items use `image-service/src/assets/items/<original ID>.svg` and their same-named `styles/*.css`. Shadowfang uses `canines/complete/WWWWWOLF.svg`; Crest Mummy uses `eagles/complete/WWWMUMMY.svg`, each with its stylesheet. SVG fragments are wrapped and their viewBoxes cropped to drawing bounds; original character paths and colours remain unchanged. Asset checksums are recorded in `REBIRTH-ASSETS.sha256`.
