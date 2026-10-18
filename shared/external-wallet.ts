import type { Instruction } from "@tari-project/ootle-ts-bindings";

export interface WalletIntent {
  account: string;
  paymentAddress: string;
  component: string;
  door: number;
  nonce: string;
}
export function intentMessage(i: WalletIntent) {
  if (
    !/^component_[a-f0-9]{64}$/.test(i.account) ||
    !/^component_[a-f0-9]{64}$/.test(i.component) ||
    !/^otl_esm_[a-z0-9]+$/.test(i.paymentAddress) ||
    i.paymentAddress.length > 512 ||
    !/^[a-f0-9]{64}$/.test(i.nonce) ||
    ![0, 1, 2].includes(i.door)
  )
    throw new Error("Invalid wallet incubation intent");
  // The player signs this ID on chain. Binding the entire payment address prevents
  // substituting a different view key while retaining the player's public owner key.
  return JSON.stringify([
    "midnight-kennel:external:v1",
    "esmeralda",
    i.component,
    i.account,
    i.paymentAddress,
    i.door,
    i.nonce,
  ]);
}
export async function sha256(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function intentId(i: WalletIntent) {
  return (await sha256(intentMessage(i))).slice(0, 32);
}

// Only the three fixed argument forms used by this contract. Checked against the
// official SDK in tests; keeping WASM/key derivation out of the browser bundle.
function textLiteral(value: string) {
  if (!/^[a-f0-9]{32}(?:[a-f0-9]{32})?$/.test(value))
    throw new Error("Invalid hex argument");
  return {
    Literal:
      "78" +
      value.length.toString(16) +
      Array.from(new TextEncoder().encode(value), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join(""),
  };
}
export function playerInstructions(
  component: string,
  id: string,
  operation:
    | { kind: "begin"; account: string; door: number }
    | { kind: "hatch"; variant: number; salt: string },
): Instruction[] {
  if (!/^component_[a-f0-9]{64}$/.test(component) || !/^[a-f0-9]{32}$/.test(id))
    throw new Error("Invalid contract address or incubation");
  const n = operation.kind === "begin" ? operation.door : operation.variant;
  if (!Number.isInteger(n) || n < 0 || n > (operation.kind === "begin" ? 2 : 3))
    throw new Error("Invalid outcome");
  if (
    operation.kind === "begin" &&
    !/^component_[a-f0-9]{64}$/.test(operation.account)
  )
    throw new Error("Invalid recipient");
  return [
    {
      CallMethod: {
        call: { Address: component as `component_${string}` },
        method: operation.kind === "begin" ? "begin_incubation" : "hatch",
        args:
          operation.kind === "begin"
            ? [
                textLiteral(id),
                { Literal: "d8805820" + operation.account.slice(10) },
                { Literal: "0" + n },
              ]
            : [
                textLiteral(id),
                { Literal: "0" + n },
                textLiteral(operation.salt),
              ],
      },
    },
  ];
}
