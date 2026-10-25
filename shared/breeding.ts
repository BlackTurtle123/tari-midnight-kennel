import type { Instruction, InputDeclaration } from "@tari-project/ootle-ts-bindings";
import { textArg } from "./rebirth.ts";
export interface BreedingConfig {
  component: string;
  resource: string;
  current: string;
  legacy: string;
  fee: number;
}
export interface ParentRef {
  resource: string;
  id: string;
}
export type BreedingAction =
  | { kind: "breed"; first: ParentRef; second: ParentRef }
  | { kind: "finish" | "refund"; id: string };
export interface BreedingState {
  epoch: number;
  parents: Record<string, string>;
  parentStatuses?: Record<string, number>;
  minted: number;
  requests: {
    id: string;
    first: ParentRef;
    second: ParentRef;
    targetEpoch: number;
    status: number;
    captured: boolean;
  }[];
}
export function breedingInstructions(
  c: BreedingConfig,
  account: string,
  action: BreedingAction,
): Instruction[] {
  if (![c.component, account].every((v) => /^component_[a-f0-9]{64}$/.test(v)))
    throw new Error("Invalid breeding account");
  const call = (address: string, method: string, args: any[]): Instruction => ({
    CallMethod: {
      call: { Address: address as `component_${string}` },
      method,
      args,
    },
  });
  const workspace = (id: number) => ({ Workspace: { id, offset: null } });
  if (action.kind !== "breed") {
    if (!/^[a-f0-9]{64}$/.test(action.id))
      throw new Error("Invalid breeding request");
    return [
      call(
        c.component,
        action.kind === "finish" ? "finish_breeding" : "refund_missed_epoch",
        [textArg(action.id)],
      ),
    ];
  }
  if (
    action.first.resource === action.second.resource &&
    action.first.id === action.second.id
  )
    throw new Error("Choose two different canines");
  if (!Number.isSafeInteger(c.fee) || c.fee <= 0 || c.fee > 100_000_000)
    throw new Error("Invalid breeding fee");
  const instructions: Instruction[] = [];
  for (const [i, p] of [action.first, action.second].entries()) {
    if (
      ![c.current, c.legacy, c.resource].includes(p.resource) ||
      !/^resource_[a-f0-9]{64}$/.test(p.resource) ||
      !/^[a-f0-9]{32}(?:[a-f0-9]{32})?$/.test(p.id)
    )
      throw new Error("Invalid canine parent");
    instructions.push(
      call(account, "withdraw_non_fungible", [
        { Literal: "d8835820" + p.resource.slice(9) },
        { Literal: "820181" + textArg(p.id).Literal },
      ]),
      { PutLastInstructionOutputOnWorkspace: { key: i } },
    );
  }
  instructions.push(
    call(account, "withdraw", [
      { Literal: "d8835820" + "01".repeat(32) },
      { Literal: "1a" + c.fee.toString(16).padStart(8, "0") },
    ]),
    { PutLastInstructionOutputOnWorkspace: { key: 2 } },
    call(c.component, "begin_breeding", [
      workspace(0),
      workspace(1),
      workspace(2),
      { Literal: "d8805820" + account.slice(10) },
    ]),
  );
  return instructions;
}


export function breedingInputs(c: BreedingConfig, account: string, action: BreedingAction): InputDeclaration[] {
  breedingInstructions(c, account, action); // Validate the exact parent references.
  if (action.kind !== "breed") return [];
  return [action.first, action.second].map((p) => ({
    substate_id: `nft_${p.resource.slice(9)}_str_${p.id}` as InputDeclaration["substate_id"],
    version: null,
    is_write: true,
  }));
}

// A failed wallet request alone is not proof of non-execution. Only permit a
// replacement when the network confirms this exact transaction committed fees
// but rolled back the breeding action for one of these missing parent inputs.
export function confirmedMissingParentFailure(value: unknown, transactionId: string, action: BreedingAction): boolean {
  if (action.kind !== "breed") return false;
  const v = value as any;
  const final = v?.result?.Finalized;
  const result = final?.execution_result?.finalize;
  if (final?.final_decision !== "Commit" || result?.transaction_hash !== transactionId) return false;
  const rejection = result?.result?.AcceptFeeRejectRest;
  if (!Array.isArray(rejection) || rejection.length !== 2) return false;
  const reason = rejection[1]?.SubstateNotFound;
  return [action.first, action.second].some((p) =>
    typeof reason === "string" && /^At instruction #\d+: /.test(reason) &&
    reason.replace(/^At instruction #\d+: /, "") === `nft_${p.resource.slice(9)}_str_${p.id} not found`);
}
