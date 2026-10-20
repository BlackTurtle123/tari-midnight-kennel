import type { Instruction } from "@tari-project/ootle-ts-bindings";

export const HALLOWEEN_REWARDS = [
  {
    odds: 30,
    name: "Haunted Cat",
    original: "ART-H26CAT",
    image: "haunted-cat",
    kind: "Halloween pet",
    description: "Nine lives. One very haunted companion.",
  },
  {
    odds: 5,
    name: "Shadowfang",
    original: "CANI-WWWWWOLF-JU",
    image: "shadowfang",
    kind: "Canine jackpot edition",
    description: "The main game's werewolf returns under a Tari moon.",
  },
  {
    odds: 5,
    name: "Crest Mummy",
    original: "EAGL-WWWMUMMY-JU",
    image: "crest-mummy",
    kind: "Eagle jackpot edition",
    description: "An ancient familiar, ready for another life.",
  },
  {
    odds: 25,
    name: "Ghosty",
    original: "ART-GHOSTY",
    image: "ghosty",
    kind: "Halloween spirit",
    description: "A little haunting to call your own.",
  },
  {
    odds: 20,
    name: "Pumpkin Familiar",
    original: "ART-PUMPKIN",
    image: "pumpkin",
    kind: "Halloween collectible",
    description: "A familiar glow from the Arkimals pumpkin patch.",
  },
  {
    odds: 15,
    name: "Halloween Soul",
    original: "ART-H26SOUL",
    image: "halloween-soul",
    kind: "Halloween relic",
    description: "A new chapter, captured in a wandering soul.",
  },
] as const;
export interface HalloweenNFT {
  id: string;
  resource: string;
  reward: number;
  name: string;
  original: string;
  sourceResource: string;
  sourceId: string;
}
export interface RebirthInput {
  resource: string;
  id: string;
  reward?: number;
}
export interface RebirthConfig {
  component: string;
  resource: string;
  current: string;
  legacy: string;
  staking: string;
  fee: number;
}
export interface RebirthReceipt extends RebirthInput {
  key: string;
  account: string;
  component: string;
  status: "submitting" | "submitted" | "accepted" | "rejected";
  transactionId?: string;
  createdAt: string;
  operation?: EconomyAction;
}
export function validateRebirth(input: RebirthInput) {
  if (
    !/^resource_[a-f0-9]{64}$/.test(input.resource) ||
    !/^[a-f0-9]{32}$/.test(input.id)
  )
    throw new Error("Invalid canine");
}
export interface EconomyState {
  epoch: number;
  requests: {
    id: string;
    resource: string;
    token: string;
    targetEpoch: number;
    status: number;
    reward: number;
    captured: boolean;
  }[];
  stakes: { id: string; resource: string; token: string; claimable: string }[];
  totalStaked: number;
  distributed: string;
  claimed: string;
  emptyPoolFees: string;
}
export type EconomyAction =
  | { kind: "begin" | "stake"; resource: string; id: string }
  | { kind: "finish" | "refund" | "claim" | "unstake"; id: string };
export function textArg(text: string) {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 255) throw new Error("Argument too long");
  return {
    Literal:
      (bytes.length < 24
        ? (0x60 + bytes.length).toString(16)
        : "78" + bytes.length.toString(16).padStart(2, "0")) +
      Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
  };
}
const componentArg = (value: string) => ({
  Literal: "d8805820" + value.slice(10),
});
export function economyInstructions(
  config: RebirthConfig,
  account: string,
  action: EconomyAction,
): Instruction[] {
  if (
    ![config.component, config.staking, account].every((v) =>
      /^component_[a-f0-9]{64}$/.test(v),
    )
  )
    throw new Error("Invalid economy account");
  const call = (address: string, method: string, args: any[]): Instruction => ({
    CallMethod: {
      call: { Address: address as `component_${string}` },
      method,
      args,
    },
  });
  const workspace = (id: number) => ({ Workspace: { id, offset: null } });
  if (action.kind === "begin" || action.kind === "stake") {
    validateRebirth(action);
    if (![config.current, config.legacy].includes(action.resource))
      throw new Error("Unsupported canine collection");
    const result: Instruction[] = [
      call(account, "withdraw_non_fungible", [
        { Literal: "d8835820" + action.resource.slice(9) },
        { Literal: "820181" + textArg(action.id).Literal },
      ]),
      { PutLastInstructionOutputOnWorkspace: { key: 0 } },
    ];
    if (action.kind === "stake")
      return [
        ...result,
        call(config.staking, "stake", [workspace(0), componentArg(account)]),
      ];
    if (
      !Number.isSafeInteger(config.fee) ||
      config.fee <= 0 ||
      config.fee > 100_000_000
    )
      throw new Error("Invalid rebirth fee");
    // Amount is a CBOR positive integer in microtari, verified against Rust in engine tests.
    const amount =
      config.fee <= 0xffffffff
        ? "1a" + config.fee.toString(16).padStart(8, "0")
        : "1b" + config.fee.toString(16).padStart(16, "0");
    return [
      ...result,
      call(account, "withdraw", [
        { Literal: "d8835820" + "01".repeat(32) },
        { Literal: amount },
      ]),
      { PutLastInstructionOutputOnWorkspace: { key: 1 } },
      call(config.component, "begin_rebirth", [
        workspace(0),
        workspace(1),
        componentArg(account),
      ]),
    ];
  }
  const stake = action.kind === "claim" || action.kind === "unstake";
  if (
    stake
      ? !/^resource_[a-f0-9]{64}\|str_[a-f0-9]{32}$/.test(action.id)
      : !/^[a-f0-9]{64}$/.test(action.id)
  )
    throw new Error("Invalid position");
  return [
    call(
      stake ? config.staking : config.component,
      {
        finish: "finish_rebirth",
        refund: "refund_missed_epoch",
        claim: "claim",
        unstake: "unstake",
      }[action.kind],
      [textArg(action.id)],
    ),
  ];
}
export function rebirthInstructions(
  config: RebirthConfig,
  account: string,
  input: RebirthInput,
): Instruction[] {
  return economyInstructions(config, account, {
    kind: "begin",
    resource: input.resource,
    id: input.id,
  });
}
