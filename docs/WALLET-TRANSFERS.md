# Transfers and seed backup

Player login now uses Sapient only. Open its extension, select the connected Esmeralda account and use Send to transfer Tari or supported NFTs. Verify the complete recipient and asset inside Sapient. The game never receives signing keys. Connecting, disconnecting or reading backup instructions moves no assets.

## Public Tari for rebirth and fees

Rebirth needs 8 public spendable tTARI plus network fees. Private funds must be unshielded inside Sapient first. If an account holds only private Tari and lacks the public native-Tari vault, a small public deposit from a funded wallet can initialize it before unshielding. Any such transfer requires the owner's explicit intent; the game does not perform it automatically.

## Seed backup

Back up recovery words inside Sapient following its own recovery instructions. The game cannot export the phrase and never asks users to paste it. There are no seed import, export or backup panels in the game UI.

## Retired hosted wallets

Legacy login, transfers and player-signing HTTP routes are disabled, including for existing valid cookies. They cannot create new hosted accounts. Existing wallet databases, shared master seed, private configuration, session key, identity cookies, NFTs and append-only journals remain intact. Their assets are not automatically transferred to Sapient. Keep the original browser identity for operator-assisted recovery if needed.

There is no per-player hosted mnemonic: these old accounts share a master seed with other players and the operator. Never disclose that seed to a player or import it into their extension.

The legacy service modules and their tests remain available for maintenance review; they are not wired into the public application. Before any manual recovery, capture and verify complete data and secrets outside the live target. Match the exact original owner, recipient, asset and saved transaction state; reconcile unknown acknowledgements before any retry. Preserve original journals and never reset them to force a send. Migration requires explicit authorization for the selected assets and destination.
