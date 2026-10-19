export type TransferAsset =
  | { kind: "tari"; amount: string; visibility?: "private" | "public" }
  | { kind: "canine"; id: string; resource: string };
export interface TransferInput {
  destination: string;
  asset: TransferAsset;
}
export interface TransferReceipt extends TransferInput {
  id: string;
  source: string;
  createdAt: string;
  status: "prepared" | "submitting" | "submitted" | "accepted" | "rejected";
  transactionId?: string;
  error?: string;
  maxFee: string;
}
export function microTari(amount: string): bigint {
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,6})?$/.test(amount))
    throw new Error(
      "Enter a positive tTARI amount with at most six decimal places",
    );
  const [whole, fraction = ""] = amount.split(".");
  const n = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  if (n <= 0n) throw new Error("Amount must be greater than zero");
  return n;
}
