# TLK-1557 — Arkimals Halloween rebirth

The MVP exchanges one existing Tari canine for one chosen Halloween NFT: Haunted Cat, Shadowfang or Crest Mummy. There is no random draw, rarity probability, currency yield, main-game redemption or cross-chain bridge. These are new Esmeralda testnet editions with the main game's original artwork and identifiers.

## On-chain behavior

`rebirth-contract` is a separate immutable template/component. The existing incubator, resources, pending commitments and opening memos are untouched. Construction fixes the current and original canine resource addresses. A player authorizes a built-in account `withdraw_non_fungible`, passes its actual bucket to `rebirth`, and receives the selected reward in that same transaction. The contract accepts exactly one NFT from the configured collections.

The original canine is **permanently retired into a contract vault**, not burnt. There is no vault withdrawal method or owner/admin recovery. It leaves the player's wallet. A failed reward mint or deposit rolls the retirement back. Fees may still apply to rejected transactions. The UI requires review and an acknowledgement before the exchange.

The reward ID is SHA-256 of `arkimals:rebirth:v1|{source_resource}|{source_id}`, where the Rust source ID is `str_<incubation id>`. Immutable metadata records the original art identifier, source collection and source token. It does not invent cat genetics or mislabel a pet as a canine. Rewards cannot be fed back into this rebirth component.

## Wallets and recovery

Sapient withdraws and signs inside the extension. Append-only browser metadata retains the original reward and durable wallet request ID across reloads. An uncertain acknowledgement blocks a new request. A confirmed original request is checked again instead of being submitted twice.

Existing hosted wallets use the same account, cookie identity, master seed and wallet daemon. A separate hash-chained, fsynced `rebirth-requests-v1.jsonl` records the source and selected reward **before** submission. No existing journal or seed is rewritten. Authentication and origin checks match the existing wallet endpoints. Holdings are rechecked before submission; uncertain acknowledgements require reconciliation. Test Tari transfers still default to public. Halloween NFTs can be transferred through the existing NFT controls.

## Deployment

Build/test the new crate, include its WASM in the application image, and deploy the application through the verified staging gateway. Before any wallet publication/create operation, capture and verify a complete wallet before-image outside the live deployment. Run `npm run deploy:rebirth` inside the deployed container. The script estimates publication fees, reserves creation fees, writes submission markers before sending, waits for accepted receipts and creates `rebirth-v1.json` exclusively. It never replaces the original deployment descriptors. Unknown publication/create acknowledgements stop retries for reconciliation.

Only deployment consumes operator test funds. Do not exchange a player's existing NFT for a smoke test. Engine tests and simulated browser fixtures are separate from live user acceptance.

## Artwork provenance

Source repository: `BlackTurtle123/wavesducks`, local reference `wavesducks-portal-TLK-1549`.

| UI asset | Main-game source | Original identifier |
| --- | --- | --- |
| Arkimals wordmark | `public/img/branding/logo-text.svg` | Arkimals |
| Haunted Cat | `image-service/src/assets/items/ART-H26CAT.svg`, `styles/ART-H26CAT.css` | ART-H26CAT |
| Shadowfang | `image-service/src/assets/canines/complete/WWWWWOLF.svg`, `styles/WWWWWOLF.css` | CANI-WWWWWOLF-JU |
| Crest Mummy | `image-service/src/assets/eagles/complete/WWWMUMMY.svg`, `styles/WWWMUMMY.css` | EAGL-WWWMUMMY-JU |

The SVG fragment and corresponding stylesheet are wrapped locally into standalone SVG files. The pet's viewBox is cropped to its original drawing bounds for display. Character paths and colours are unchanged. Names come from the main-game constants and English Halloween catalogue. Palette references: `src/styles/colors.scss` (dark #19202e, yellow #ffd346, turquoise #90c1cc).

The original contest secret remains the encrypted incubation outcome, privately previewed before the player decides to reveal and mint. Rebirth is a public, chosen exchange; it makes no additional privacy or randomness claim.
