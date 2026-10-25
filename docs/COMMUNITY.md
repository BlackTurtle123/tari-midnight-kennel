# Public rankings and farm visits

Open `#ranking` or share `#farm/component_<64 hex characters>`. No wallet login
or signature is needed. Public pages show only game NFTs and their public
metadata; they do not expose wallet balances, payment addresses, private
incubation openings, hosted-account journals, or wallet keys.

The directory discovers participants from the current and original incubation
contracts, breeding requests, and all deployed rebirth/staking contracts.
It checks current account vaults rather than attributing NFTs to their minter.
A wallet that only receives a transfer appears after participating in the game;
this is a game-participant ranking, not an exhaustive Esmeralda holder index.
The current public indexer does not expose an all-holders NFT listing.

Counts include canonical canines and Halloween rewards from the configured game
resources. Each resource/token pair counts once. Staked NFTs, breeding parents,
and pending rebirth offerings count toward the contract-recorded recipient, and
must still be present in that contract's vault. Completed/burned offerings,
unknown resources and unrelated NFTs do not count. Tied totals share a competition
rank (1, 1, 3). Empty participants remain visitable but do not occupy a ranking.

Reads require verified, live indexer substates. A refresh has at most four account
readers and memoizes shared contract/vault/NFT reads. One service-wide refresh
runs at a time; successful snapshots are cached for 60 seconds. Failed refreshes
have a 15-second cooldown. The last successful snapshot is available for at most
15 minutes and explicitly marked stale; an initial or prolonged failure is an
error, never a fabricated zero or a partial ranking. A contradictory ownership
snapshot fails instead of crediting the same NFT to two farms.

`GET /api/community/ranking` returns ranked totals and three preview NFTs per
farm. `GET /api/community/farms/:account` returns one participant's collection.
Malformed addresses return 400; unknown farms return 404. All existing host and
origin checks still apply. The feature makes no on-chain transactions and needs
no new contract deployment, database, wallet migration or persistent data write.

Developer verification: `npm test` and `npm run build`. Community tests cover
transfers, tied ranks, empty farms, unrelated assets, active/recovery stakes,
escrowed parents, pending versus burned rebirth offerings, canonical Halloween
NFTs, duplicate IDs, conflicting ownership, public HTTP access, and cache failures.
