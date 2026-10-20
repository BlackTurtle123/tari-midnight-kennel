import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
export const DATA_DIR =
  process.env.KENNEL_DATA_DIR ||
  join(homedir(), ".local/share/tari-midnight-kennel");
export const WALLET_URL =
  process.env.TARI_WALLET_URL || "http://127.0.0.1:15101/json_rpc";
export const PLAYER_NAME = process.env.TARI_PLAYER_ACCOUNT || "kennel-player";
export const OPERATOR_NAME =
  process.env.TARI_OPERATOR_ACCOUNT || "kennel-operator";
export const TARI_RESOURCE = "resource_" + "01".repeat(32);
export interface Deployment {
  network: "esmeralda";
  template: string;
  component: string;
  resource: string;
  operator: string;
  publicationTx: string;
  creationTx: string;
  createdAt: string;
}
export const deploymentPath = join(DATA_DIR, "deployment-v2.json");
export function deployment(): Deployment {
  if (!existsSync(deploymentPath))
    throw new Error(
      "The testnet incubator is not deployed yet. Complete the wallet and contract setup in the README.",
    );
  const d = JSON.parse(readFileSync(deploymentPath, "utf8")) as Deployment;
  if (
    d.network !== "esmeralda" ||
    !d.component.startsWith("component_") ||
    !d.resource.startsWith("resource_")
  )
    throw new Error("Invalid testnet deployment configuration");
  return d;
}

export function legacyResource(): string | undefined {
  const path = join(DATA_DIR, "deployment.json");
  if (!existsSync(path)) return undefined;
  const d = JSON.parse(readFileSync(path, "utf8"));
  if (
    d.network !== "esmeralda" ||
    typeof d.resource !== "string" ||
    !/^resource_[a-f0-9]{64}$/.test(d.resource)
  )
    throw new Error("Invalid legacy deployment configuration");
  return d.resource;
}

export function rebirthDeployment():
  | (Deployment & {
      current: string;
      legacy: string;
      staking: string;
      fee: number;
    })
  | undefined {
  const path = join(DATA_DIR, "rebirth-v1.json");
  if (!existsSync(path)) return undefined;
  const d = JSON.parse(readFileSync(path, "utf8"));
  if (
    d.network !== "esmeralda" ||
    !/^component_[a-f0-9]{64}$/.test(d.staking) ||
    !Number.isSafeInteger(d.fee) ||
    d.fee <= 0 ||
    d.fee > 100_000_000 ||
    !/^component_[a-f0-9]{64}$/.test(d.component) ||
    ![d.resource, d.current, d.legacy].every(
      (v: unknown) =>
        typeof v === "string" && /^resource_[a-f0-9]{64}$/.test(v),
    ) ||
    d.current !== deployment().resource ||
    d.legacy !== (legacyResource() ?? deployment().resource)
  )
    throw new Error(
      "Invalid rebirth deployment; existing collections preserved",
    );
  return d;
}

export function breedingDeployment():
  (Deployment & import("../shared/breeding.ts").BreedingConfig) | undefined {
  const path = join(DATA_DIR, "breeding-v1.json");
  if (!existsSync(path)) return undefined;
  const d = JSON.parse(readFileSync(path, "utf8"));
  if (
    d.network !== "esmeralda" ||
    !/^component_[a-f0-9]{64}$/.test(d.component) ||
    !/^template_[a-f0-9]{64}$/.test(d.template) ||
    ![d.resource, d.current, d.legacy].every(
      (v: unknown) =>
        typeof v === "string" && /^resource_[a-f0-9]{64}$/.test(v),
    ) ||
    !Number.isSafeInteger(d.fee) ||
    d.fee <= 0 ||
    d.fee > 100_000_000 ||
    d.current !== deployment().resource ||
    d.legacy !== (legacyResource() ?? deployment().resource)
  )
    throw new Error("Invalid breeding deployment; previous assets preserved");
  return d;
}

// Retained for withdrawals, pending rituals and receipts from the retired offspring pool.
export function offspringRebirthDeployment(): ReturnType<
  typeof rebirthDeployment
> {
  const path = join(DATA_DIR, "offspring-rebirth-v1.json");
  if (!existsSync(path)) return undefined;
  const d = JSON.parse(readFileSync(path, "utf8"));
  const bred = breedingDeployment();
  if (
    !bred ||
    d.network !== "esmeralda" ||
    ![d.component, d.staking].every(
      (v) => typeof v === "string" && /^component_[a-f0-9]{64}$/.test(v),
    ) ||
    ![d.template].every(
      (v) => typeof v === "string" && /^template_[a-f0-9]{64}$/.test(v),
    ) ||
    !/^resource_[a-f0-9]{64}$/.test(d.resource) ||
    d.current !== bred.resource ||
    d.legacy !== bred.resource ||
    !Number.isSafeInteger(d.fee) ||
    d.fee <= 0 ||
    d.fee > 100_000_000
  )
    throw new Error(
      "Invalid offspring economy deployment; original pool preserved",
    );
  return d;
}

export function unifiedRebirthDeployment():
  | (NonNullable<ReturnType<typeof rebirthDeployment>> & { offspring: string })
  | undefined {
  const path = join(DATA_DIR, "rebirth-unified-v2.json");
  if (!existsSync(path)) return undefined;
  const d = JSON.parse(readFileSync(path, "utf8"));
  const bred = breedingDeployment();
  if (
    !bred ||
    d.network !== "esmeralda" ||
    ![d.component, d.staking].every(
      (v) => typeof v === "string" && /^component_[a-f0-9]{64}$/.test(v),
    ) ||
    !/^template_[a-f0-9]{64}$/.test(d.template) ||
    !/^resource_[a-f0-9]{64}$/.test(d.resource) ||
    d.current !== deployment().resource ||
    d.legacy !== (legacyResource() ?? deployment().resource) ||
    d.offspring !== bred.resource ||
    !Number.isSafeInteger(d.fee) ||
    d.fee <= 0 ||
    d.fee > 100_000_000
  )
    throw new Error(
      "Invalid unified economy deployment; previous assets preserved",
    );
  return d;
}

export function activeRebirthDeployment() {
  return unifiedRebirthDeployment() ?? rebirthDeployment();
}

export function recoveryRebirthDeployments() {
  return [
    ...(unifiedRebirthDeployment() ? [rebirthDeployment()] : []),
    offspringRebirthDeployment(),
  ].filter((c): c is NonNullable<typeof c> => !!c);
}
