import type { Canine } from "./game";
import type { HalloweenNFT } from "./rebirth";

export type FarmNFT =
  | { kind: "canine"; status: "wallet" | "staked" | "breeding" | "rebirth"; nft: Canine }
  | { kind: "halloween"; status: "wallet"; nft: HalloweenNFT };
export interface Farm {
  account: string;
  total: number;
  canines: number;
  halloween: number;
  staked: number;
  nfts: FarmNFT[];
}
export interface RankedFarm extends Omit<Farm, "nfts"> {
  rank: number;
  preview: FarmNFT[];
}
export interface Ranking {
  updatedAt: string;
  stale: boolean;
  farms: RankedFarm[];
  totalNFTs: number;
}
export interface FarmView {
  updatedAt: string;
  stale: boolean;
  farm: Farm;
  rank?: number;
}
export const farmHref = (account: string) => `#farm/${account}`;
export const farmName = (account: string) =>
  `Farm ${account.slice(10, 16)}…${account.slice(-4)}`;
