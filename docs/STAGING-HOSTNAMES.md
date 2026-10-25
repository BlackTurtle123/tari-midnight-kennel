# Dedicated game hostnames

Requested DNS records in the authoritative Versio zone `arkimals-game.com`:

| Name | Type | Value | TTL |
| --- | --- | --- | --- |
| tari.staging | A | 217.100.219.253 | 600 |
| near.staging | A | 217.100.219.253 | 600 |

Preserve existing records. Capture the complete visible zone before editing and
verify that these names are absent; read back both records after saving and
check the authoritative nameservers. A DNS rollback removes only these new
records, after capturing their then-current state.

Both applications serve at the root of their dedicated hostnames. Existing
`/tari/` and `/near/` paths remain valid for assets, API requests, wallet callbacks
and old bookmarks. The original `staging.wavesducks.com` routes remain available.
No wallet keys, chain state or incubation records are moved. Browser permissions
and local storage are origin-specific, so a wallet may ask to reconnect on the
new domain; users with an unfinished browser approval can still use the old URL.

Tari explicitly allows the additional HTTPS origin via
`KENNEL_ADDITIONAL_ORIGINS`. NEAR's public stateless server already supports both
root and `/near/` paths, and its wallet callback URLs use the current origin.

Host provisioning is separate from the application release:

1. Deploy the tested Tari origin allowlist update through the existing gateway.
2. Run `deploy/provision-staging-hostnames.py --source <uploaded deploy files>
   --phase http` as the staging administrator on `arkimals-c`.
3. Add and verify the two DNS A records.
4. Run the same script with `--phase https`. It issues the shared
   `arkimals-staging-games` certificate through the existing Certbot account,
   installs the HTTPS hosts and a renewal reload hook, tests Nginx and reloads.
5. Verify both HTTPS roots, JS/CSS/artwork, Tari config/API origin restrictions,
   NEAR health, redirects from HTTP and the existing staging routes. Verify
   certificate renewal using Certbot's dry run. Record observed browser checks
   separately from wallet transaction tests.

Each provisioning phase captures the complete Nginx and Let's Encrypt
configuration outside the live target, reads back every archive member and
verifies exact membership, contents, owners, modes and symlinks before mutation.
Recovery manifests live under `/var/backups/arkimals/dedicated-game-hosts/`.
Never restore an older complete TLS directory over subsequent renewals; capture
later changes and restore only affected paths using the recorded before-image.
