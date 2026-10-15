# Main-game canine genetics

This PoC uses the main game’s original canine SVG layers and CSS, copied without redrawing or recolouring. `CANINE-ASSETS.json` records the source revision and per-file SHA-256 checksums. The renderer preserves the main game’s layer order and supports A–H in all eight positions: headwear, eyebrows, eyes, muzzle, body (also head/accessories), left limb, right limb, and tail.

Incubation mints the current genesis pool from `shared/constants/canines.ts`: EEEEEEEE / Beaglebyte Prime, FFFFFFFF / Quantum Dalmatian, GGGGGGGG / Malinox Protocol, HHHHHHHH / PoodlOS Echelon. Each is generation zero with no parents. Breeding and mixed-gene inheritance remain outside this incubation MVP. The renderer can already display mixed A–H genomes, including NFTs retained from the first PoC collection.

The opening’s variant fixes the pure genesis genome. Its salt’s first byte modulo four fixes colour A–D, using the main game’s colour names. Both inputs are bound by the v2 salted SHA-256 commitment. The contract itself writes immutable `name`, `genes`, `color`, `genotype` (`CANI-<eight genes>-G<colour>`), generation, parent, event and artwork-version metadata. Colour is a separate main-game metadata attribute; it does not recolour the SVG body parts. Trick/treat flavour is cosmetic; all doors share the same operator-generated distribution, which is not trustless randomness.

The v2 deployment uses separate deployment receipt and incubation journal files. The original contract, receipts, journal and NFTs are retained. The collection reads both verified resource addresses, shows old NFTs with their original names/genes, and never invents colour or genotype metadata absent from those NFTs.

No Waves NFT is bridged or transferred. These are new Tari Esmeralda testnet collectibles using the main game’s artwork and genetics conventions.
