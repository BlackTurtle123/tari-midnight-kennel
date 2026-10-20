import type { Instruction } from "@tari-project/ootle-ts-bindings";

export const HALLOWEEN_REWARDS = [
  {
    name: "Haunted Cat",
    original: "ART-H26CAT",
    image: "haunted-cat",
    kind: "Halloween pet",
    description: "Nine lives. One very haunted companion.",
  },
  {
    name: "Shadowfang",
    original: "CANI-WWWWWOLF-JU",
    image: "shadowfang",
    kind: "Canine jackpot edition",
    description: "The main game's werewolf returns under a Tari moon.",
  },
  {
    name: "Crest Mummy",
    original: "EAGL-WWWMUMMY-JU",
    image: "crest-mummy",
    kind: "Eagle jackpot edition",
    description: "An ancient familiar, ready for another life.",
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
  reward: number;
}
export interface RebirthConfig {
  component: string;
  resource: string;
  current: string;
  legacy: string;
}
export interface RebirthReceipt extends RebirthInput {
  key: string;
  account: string;
  component: string;
  status: "submitting" | "submitted" | "accepted" | "rejected";
  transactionId?: string;
  createdAt: string;
}
export function validateRebirth(input: RebirthInput) {
  if (
    !/^resource_[a-f0-9]{64}$/.test(input.resource) ||
    !/^[a-f0-9]{32}$/.test(input.id) ||
    !Number.isInteger(input.reward) ||
    input.reward < 0 ||
    input.reward >= HALLOWEEN_REWARDS.length
  )
    throw new Error("Invalid canine or Halloween reward");
}
// Fixed CBOR argument forms, verified against the official SDK by tests.
export function rebirthInstructions(
  config: RebirthConfig,
  account: string,
  input: RebirthInput,
): Instruction[] {
  validateRebirth(input);
  if (
    ![config.current, config.legacy].includes(input.resource) ||
    !/^component_[a-f0-9]{64}$/.test(config.component) ||
    !/^component_[a-f0-9]{64}$/.test(account)
  )
    throw new Error("This canine collection cannot enter this rebirth");
  // NonFungibleId::String, whose minicbor enum index is 1.
  const text = Array.from(new TextEncoder().encode(input.id), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return [
    {
      CallMethod: {
        call: { Address: account as `component_${string}` },
        method: "withdraw_non_fungible",
        args: [
          { Literal: "d8835820" + input.resource.slice(9) },
          { Literal: "8201817820" + text },
        ],
      },
    },
    { PutLastInstructionOutputOnWorkspace: { key: 0 } },
    {
      CallMethod: {
        call: { Address: config.component as `component_${string}` },
        method: "rebirth",
        args: [
          { Workspace: { id: 0, offset: null } },
          { Literal: "d8805820" + account.slice(10) },
          { Literal: "0" + input.reward },
        ],
      },
    },
  ];
}
