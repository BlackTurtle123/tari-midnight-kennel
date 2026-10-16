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
