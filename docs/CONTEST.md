# October 2026 contest: Spooky Secrets

Sources checked on 15 October 2026: [October theme and submission thread](https://community.tari.com/t/october-build-contest-thread-spooky-secrets/396) and [official rules and organizer clarification](https://community.tari.com/t/ootle-launch-date-and-launch-contest-rules/323/1). The organizer’s rules take precedence over this checklist.

## Theme implemented

Halloween porches lead to six spooky canine NFT variants. The secret is the canine result plus a 256-bit salt. A public commitment binds it; Tari’s native stealth memo transports it encrypted. The wallet opens it privately; the player explicitly reveals it to mint. Both tricks and treats produce cosmetic canines, so NFT issuance is central to the validation.

The operator knows the secret. The player’s identity is not anonymous. NFT traits become public after reveal. See [privacy and trust](PRIVACY.md). Native memo delivery remains pending public-testnet verification; a private preview in the interface is not itself evidence of confidentiality.

## Submission checklist

- [x] Fresh repo and new code after the October 1 theme announcement; no copied submissions.
- [x] OSI-approved license: MIT.
- [x] Halloween theme plus a concrete Tari privacy flow in the implementation.
- [ ] Complete live deployment and record a real encrypted memo and NFT mint.
- [ ] Publicly accessible source link, project description, entrant’s Tari prize-payment address, and public announcement link in the October forum entry.
- [ ] Announce on **Bluesky or Reddit**, as specifically required for October.
- [ ] Confirm entrant is neither a Tari Council member nor a Tari Labs employee.
- [ ] Submit **one post**; edit that post with an update section for later changes. Use a separate projects-category thread for discussion.
- [ ] Submit before **1 November 2026 at 00:00 UTC** (the general rule’s start-of-next-month cutoff).

AI-assisted development is allowed in the organizer’s clarification. Theme adherence and code quality can affect judging. Eligibility and awards are decided by the Council, not by this app. No submission or social post is published automatically. The dedicated Esmeralda test account is **not** a substitute for the entrant’s prize-payment address.

## Submission draft — complete placeholders before posting

**Midnight Kennel — a secret canine behind every haunted door**

Code: [repository URL]

Pick a Halloween doorway and incubate a canine NFT. The operator commits a salted hash, then delivers the opening through a native Tari encrypted stealth memo. The player previews their surprise privately and chooses when to reveal it. The contract checks the commitment and signer and mints one NFT into the recipient fixed at incubation. The UI shows real wallet inventory.

Privacy boundaries: the operator knows the result; incubation account, timing and fees can be linked; minting publishes the result and NFT metadata. This is a private surprise rather than anonymous gameplay or a provably fair lottery.

Verification: [insert accepted testnet transaction references after testing; do not claim pending work passed].

Tari prize-payment address: [entrant supplies address]

Public Bluesky/Reddit announcement: [link]

License: MIT. New October code, developed with AI assistance.
