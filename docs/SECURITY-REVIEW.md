# Security review — 25 October 2026

Scope: repository source, reachable local Git history, tracked-file inventory, API boundaries, player intent binding, journal serialization, deployment isolation and dependency advisories. This is a focused maintainer review, not an independent penetration test or formal contract audit. It does not inspect every GitHub artifact/log/fork, the host OS, or wallet binary internals.

## Addressed

- **Internal error disclosure:** the HTTP handler previously returned arbitrary exception messages. Provider/filesystem failures now return fixed text. Only explicitly marked, application-authored messages are public. Validation and JSON-parser errors do not echo submitted fields or values. Regression tests inject mock credentials and memo text and assert they never appear in responses.
- **Request parsing:** host/origin/mutation-header checks run before JSON parsing. Compressed request bodies are refused; JSON remains capped at 8 KiB. Malformed, oversized and compressed requests have fixed responses.
- **Dependency advisories:** updated body-parser to 2.4.0 and Zod to 4.6.7, adapting record schemas to the new API. npm audit reports zero known advisories after these changes. References: [body-parser advisory](https://github.com/advisories/GHSA-27r3-jxmh-p828), [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- **Journal exposure guardrail:** public incubation views enumerate allowed fields rather than spreading the rest of a private record. A regression test ensures an unexpected private field remains excluded.
- **Accidental files:** expanded Git/Docker exclusions for keys, wallet databases, journals, logs and private data directories. No private runtime file is intentionally committed.

## Secret scan

Gitleaks 8.30.1 scanned 43 reachable commits (before this cleanup commit) and the working directory. It reported three matches in the public Waves oracle fixture `docs/main-game-rules/rebirth-bonus-live.json`. These are blockchain data-entry names containing a public account address, not authentication credentials. A narrow allowlist identifies those exact public keys. No confirmed credential, private key or seed leak was found by this scan; this is not a guarantee that all possible secrets are detectable.

Public deployment addresses, accepted transaction hashes, artwork checksums, source provenance and the author's public support email are intentional. Deployment scripts also disclose the host IP, deployment username and filesystem layout. Those are infrastructure metadata, not access credentials; removing them from current docs would not erase their Git history. Obsolete incident details and private backup timestamps were removed from the public setup guide. No history rewrite or credential rotation was performed because no live credential leak was confirmed.

## Remaining dependency findings

An OSV query of 434 unique registry package/version pairs across the five Rust lockfiles found:

| Package | Finding | Assessment |
| --- | --- | --- |
| memmap2 0.6.2 | [RUSTSEC-2026-0186](https://rustsec.org/advisories/RUSTSEC-2026-0186.html), unchecked pointer offsets | Transitive via shared-buffer → Wasmer → Tari engine test tooling. Not in the contract's normal/build dependency graph. A compatible upstream tooling upgrade is still needed; no ad-hoc engine fork or on-chain upgrade was made. |
| bincode 1.3.3 | RUSTSEC-2025-0141 | Unmaintained-package notice |
| paste 1.0.15 | RUSTSEC-2024-0436 | Unmaintained-package notice |
| proc-macro-error2 2.0.1 | RUSTSEC-2026-0173 | Unmaintained-package notice |
| unsafe-libyaml 0.2.11 | RUSTSEC-2024-0449 | Unmaintained-package notice |

These notices are not silently suppressed. The separately downloaded walletd binary is checksum-pinned, but its full embedded dependency graph is not covered by the application's lockfile scan.

## Design limits retained

The old incubator contract permits direct unpaid reservations; the delivery service requires the treasury payment before generating a new paid secret. Thus bypassing the payment does not grant free delivery, but direct reservations can consume limited event capacity. Per-signer limits do not prevent Sybil exhaustion. Correcting this on-chain requires a deliberately planned replacement/upgrade and preservation of existing incubations.

The operator remains trusted for outcome selection and liveness. Public read endpoints can create upstream work; the application is not hardened against distributed denial of service. This review did not establish a new end-to-end Sapient signing/decryption pass. See [validation](VALIDATION.md).

## Checks

92 application tests and the TypeScript/Vite production build pass. npm audit reports zero known vulnerabilities. Existing contract code and lockfiles were not modified by this cleanup. Current Rust limitations are listed above instead of treating application tests as proof of contract security.
