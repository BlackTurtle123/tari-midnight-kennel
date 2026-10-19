# Transfers and seed backup

Connect the **Existing staging wallet**, then open **Transfer assets**. Choose test Tari or one of the canine NFTs actually held by that wallet, enter the recipient's full Esmeralda payment address, and select **Review transfer**. The server checks ownership, balance, network and pending incubations, then simulates that exact transfer. Review the destination, selected asset and 1 tTARI maximum fee, acknowledge the address, and press **Confirm transfer** to submit.

Finish existing incubations first. Transfer NFTs before sending the remaining coins: NFT transfers need a public fee reserve in the sender. Tari is sent as a native private output; the recipient may need to scan for incoming payments in their wallet. Canine NFTs are public and remain in their original collection with unchanged genes. The external inventory reader also recognizes transferred original-collection canines.

Transfers from Sapient itself use its native Send controls. The game does not take custody of its keys. No transfer is executed simply by connecting, switching wallets, opening a preview, or viewing seed-backup instructions.

### Public Tari for Sapient fees and unshielding

For Tari, **Recipient balance** defaults to **Public balance — for fees and unshielding**, with private transfers available as an explicit choice. Public sends deposit the amount into the recipient's public Tari vault, creating that vault when needed. The review and saved receipt preserve the selected visibility. Existing receipts without a visibility field keep their original private behavior.

A Sapient account can hold canine NFTs and private Tari without having a public Tari vault. Its Unshield flow may try to pay a public fee and withdraw a tiny public input before revealing the private funds, producing “No vault for resource resource_0101…”. A small public Tari deposit from an already funded wallet initializes the missing vault. From Existing staging wallet, review and confirm a public transfer to your own Sapient payment address (for example 1 tTARI); after confirmation, retry Unshield inside Sapient. This exposes the deposited amount and recipient on-chain, does not export keys, and does not automatically move or unshield the rest of your private funds.

## Recovery and duplicate prevention

The new `wallet-transfers-v1.jsonl` journal is append-only, hash chained and fsynced before submission. It preserves the entire review and every state transition, separately from all existing wallet and incubation data. Source account and fee payer are resolved from the authenticated browser session, never from a client-supplied name. Confirmation accepts only a saved review ID, so its recipient and asset cannot be replaced. Reviews expire after ten minutes; accepted or uncertain transfer IDs cannot submit again.

The hosted UI reloads saved transfer history. **Check transfer** waits for the existing transaction receipt. A missing submission acknowledgement blocks subsequent transfers for that account until a developer reconciles it; it never silently retries. Confirmed rejections are shown explicitly, including the possibility of charged fees. Operator/game transactions and transfers share the same serialized wallet queue.

Before manual recovery, capture and verify the complete data and secrets directories outside the live target. Preserve the original transfer journal and inspect the wallet's transaction history for the exact source, recipient and asset before recording a reconciled receipt. Never delete the journal to retry a transfer.

## Seed export boundary

The **Export / back up seed** panel is guidance, not a seed-reading API. For Sapient, open the extension's Settings and recovery-phrase/mnemonic screen and complete its password check there. The game never requests, receives, copies or stores the words.

Existing hosted player accounts derive from one shared wallet master seed. There is no separate per-player mnemonic that can be exported from this setup. Publishing that master seed to any player would also expose other players and the operator. Therefore no browser endpoint exports it. To obtain an independent exportable recovery phrase, create a personal Sapient wallet, back it up inside the extension, and explicitly transfer assets to its address. Existing hosted wallets, seeds, cookies and recovery files remain intact.

## Verification scope

Automated tests cover exact decimal conversion; simulation before confirmation; immutable destination/asset/source; fee payer isolation; NFT ownership revalidation; cross-session and cross-origin denial; unknown acknowledgement/restart recovery; pending/rejected receipts; insufficient funds and pending-incubation blocks. SDK requests were checked against the pinned Tari walletd v0.46.1 source. A live transfer is not claimed until someone explicitly chooses a recipient/asset and completes confirmation; local mocked wallet responses are not chain settlement.
