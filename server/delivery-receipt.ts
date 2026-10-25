import { z } from "zod";

const hex = z.string().regex(/^[a-f0-9]{64}$/);
const receipt = z.object({
  transaction_id: hex,
  status: z.literal("Accepted"),
  timed_out: z.literal(false),
  result: z.object({
    transaction_hash: hex,
    result: z.object({ Accept: z.object({
      up_substates: z.array(z.tuple([z.string(), z.object({ substate: z.record(z.string(), z.unknown()) })])),
    }) }),
  }),
});
const prefix = "utxo_" + "01".repeat(32) + "_";

// Public output commitments only. Never return receipt logs, wallet metadata,
// encrypted output data or the operator's private opening through the API.
export function deliveryCommitments(value: unknown, transactionId: string): string[] {
  const r = receipt.parse(value);
  if (r.transaction_id !== transactionId || r.result.transaction_hash !== transactionId)
    throw new Error("Delivery receipt does not match the saved transaction");
  const outputs = r.result.result.Accept.up_substates.flatMap(([id, state]) => {
    if (!id.startsWith(prefix) || !("Utxo" in state.substate)) return [];
    return [hex.parse(id.slice(prefix.length))];
  });
  if (!outputs.length || outputs.length > 8 || new Set(outputs).size !== outputs.length)
    throw new Error("Unexpected delivery outputs");
  return outputs;
}
