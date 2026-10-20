// Genesis roster from the main game's shared/constants/canines.ts.
export const VARIANTS = [
  {
    name: "Beaglebyte Prime",
    genes: "EEEEEEEE",
    kind: "treat",
    description: "A Beaglebyte at the pumpkin porch. A treat worth keeping.",
  },
  {
    name: "Quantum Dalmatian",
    genes: "FFFFFFFF",
    kind: "treat",
    description: "A Quantum Dalmatian with a sweet midnight surprise.",
  },
  {
    name: "Malinox Protocol",
    genes: "GGGGGGGG",
    kind: "trick",
    description: "A Malinox with a mischievous Halloween secret.",
  },
  {
    name: "PoodlOS Echelon",
    genes: "HHHHHHHH",
    kind: "trick",
    description: "A PoodlOS playing a little trick after dark.",
  },
] as const;
export const GENE_POSITIONS = [
  "Headwear",
  "Eyebrows",
  "Eyes",
  "Muzzle",
  "Body",
  "Left limb",
  "Right limb",
  "Tail",
] as const;
export const COLOR_NAMES = {
  A: "Red",
  B: "Dark Purple",
  C: "Green",
  D: "Blue",
} as const;
export function colorForSalt(salt: string): keyof typeof COLOR_NAMES {
  if (!/^[a-f0-9]{64}$/.test(salt)) throw new Error("Invalid opening salt");
  return "ABCD"[parseInt(salt.slice(0, 2), 16) % 4] as keyof typeof COLOR_NAMES;
}
export function genotypeFor(genes: string, color: string) {
  return `CANI-${genes}-G${color}`;
}
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
  color?: keyof typeof COLOR_NAMES;
  genotype?: string;
  legacy?: boolean;
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
  offspringRebirth?: import("./rebirth.ts").RebirthConfig;
  offspringEconomy?: import("./rebirth.ts").EconomyState;
  breedingConfig?: import("./breeding.ts").BreedingConfig;
  breeding?: import("./breeding.ts").BreedingState;
  halloween?: import("./rebirth.ts").HalloweenNFT[];
  economy?: import("./rebirth.ts").EconomyState;
  rebirth?: import("./rebirth.ts").RebirthConfig;
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
