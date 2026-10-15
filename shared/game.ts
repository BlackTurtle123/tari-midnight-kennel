export const VARIANTS = [
  {
    name: "Pumpkin Pup",
    kind: "treat",
    coat: "#ec994f",
    accent: "#64b78a",
    description: "A warm little soul with a suspicious love of pumpkins.",
  },
  {
    name: "Moonlight Howler",
    kind: "treat",
    coat: "#c3bcf1",
    accent: "#efcf7b",
    description: "Sings to the moon. Occasionally gets an encore.",
  },
  {
    name: "Candy Corn Corgi",
    kind: "treat",
    coat: "#f0c16d",
    accent: "#f5eee0",
    description: "Short legs. Long wishlist. Impeccable candy taste.",
  },
  {
    name: "Boo Beagle",
    kind: "trick",
    coat: "#dae8df",
    accent: "#97bfbc",
    description: "Practices being scary. Mostly just says woof.",
  },
  {
    name: "Mummy Mutt",
    kind: "trick",
    coat: "#d4c6aa",
    accent: "#bd9674",
    description: "Wrapped up in mischief, and a little too much gauze.",
  },
  {
    name: "Bat-Eared Bandit",
    kind: "trick",
    coat: "#8d85ae",
    accent: "#df91ad",
    description: "Can hear a treat bag opening three streets away.",
  },
] as const;
export const DOORS = [
  {
    name: "Pumpkin Porch",
    subtitle: "Something sweet is stirring.",
    color: "#eda867",
    symbol: "pumpkin",
  },
  {
    name: "Moonlit Manor",
    subtitle: "A little mystery after midnight.",
    color: "#b9abe7",
    symbol: "moon",
  },
  {
    name: "The Crooked Crypt",
    subtitle: "Good dogs. Questionable manners.",
    color: "#9ac6ad",
    symbol: "ghost",
  },
] as const;
export interface Canine {
  id: string;
  variant: number;
  name: string;
  genes: string;
  resource: string;
  generation: number;
}
export interface Opening {
  id: string;
  variant: number;
  salt: string;
}
export type Stage =
  | "reserved"
  | "starting"
  | "started"
  | "sealing"
  | "sealed"
  | "delivering"
  | "ready"
  | "hatching"
  | "hatched";
export interface IncubationView {
  id: string;
  door: number;
  stage: Stage;
  createdAt: string;
  commitment: string;
  startTx?: string;
  sealTx?: string;
  deliveryTx?: string;
  hatchTx?: string;
  error?: string;
}
export interface GameState {
  connected: boolean;
  network: string;
  account?: string;
  paymentAddress?: string;
  balance?: string;
  resource?: string;
  component?: string;
  incubations: IncubationView[];
  canines: Canine[];
  setupError?: string;
}
export const CONTEST_URL =
  "https://community.tari.com/t/october-build-contest-thread-spooky-secrets/396";
export const RULES_URL =
  "https://community.tari.com/t/ootle-launch-date-and-launch-contest-rules/323/1";
