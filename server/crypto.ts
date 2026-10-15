import { createHash, randomBytes, randomInt } from "node:crypto";
import type { Opening } from "../shared/game.ts";
export function createOpening(id: string): Opening {
  return { id, variant: randomInt(4), salt: randomBytes(32).toString("hex") };
}
export function commitmentFor(opening: Opening): string {
  if (
    !/^[a-f0-9]{32}$/.test(opening.id) ||
    !/^[a-f0-9]{64}$/.test(opening.salt) ||
    !Number.isInteger(opening.variant) ||
    opening.variant < 0 ||
    opening.variant > 3
  )
    throw new Error("Invalid reward opening");
  return createHash("sha256")
    .update(
      `midnight-kennel:v2|${opening.id}|${opening.variant}|${opening.salt}`,
    )
    .digest("hex");
}
export function encodeMemo(o: Opening): string {
  commitmentFor(o);
  return `MK2:${o.id}:${o.variant}:${o.salt}`;
}
export function decodeMemo(memo: string): Opening | null {
  const m = /^MK2:([a-f0-9]{32}):([0-3]):([a-f0-9]{64})$/.exec(memo);
  return m ? { id: m[1], variant: Number(m[2]), salt: m[3] } : null;
}
