// walletd v0.46.1 detects missing input substates before signing/storing/submitting.
// Only classify that precise RPC response; transport errors remain ambiguous.
export function missingSubstateError(error: unknown): boolean {
  if (
    !(error instanceof Error) ||
    !error.cause ||
    typeof error.cause !== "object"
  )
    return false;
  const cause = error.cause as {
    method?: string;
    code?: number;
    message?: string;
  };
  return (
    cause.method === "transactions.submit_instruction" &&
    cause.code === 404 &&
    /^Application error: 404: Not found: Substate (?:component|resource|vault)_[a-f0-9]{64} does not exist$/.test(
      cause.message ?? "",
    )
  );
}
export class NotSubmitted extends Error {}

// walletd 0.47 submit_inner resolves verified input substates before signing or
// persisting the transaction. This exact handover error is therefore retryable;
// transport errors and result-wait failures still have uncertain submission status.
export function checkpointNotReadyError(error: unknown): boolean {
  if (
    !(error instanceof Error) ||
    !error.cause ||
    typeof error.cause !== "object"
  )
    return false;
  const c = error.cause as { method?: string; code?: number; message?: string };
  return (
    c.method === "transactions.submit_instruction" &&
    c.code === 500 &&
    /^The indexer proved substate (?:component|resource|vault)_[a-f0-9]{64} at a block of Epoch\(\d+\), but has not yet served the checkpoint that hands over to that epoch's validator set\. Retry shortly, once the indexer serves it\.$/.test(
      c.message ?? "",
    )
  );
}
