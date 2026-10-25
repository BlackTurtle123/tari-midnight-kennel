export const INCUBATION_FEE = 20_000_000;
export interface IncubationFee {
  component: string;
  treasury: string;
  amount: number;
}
export function validateIncubationFee(fee: IncubationFee) {
  if (!fee || fee.amount !== INCUBATION_FEE ||
      ![fee.component, fee.treasury].every((v) => /^component_[a-f0-9]{64}$/.test(v)))
    throw new Error("Invalid incubation treasury configuration");
  // Deployment descriptors also contain receipts and network metadata. Only
  // these three fields belong in the wallet's strict API request and intent.
  return { component: fee.component, treasury: fee.treasury, amount: fee.amount };
}
export function sameIncubationFee(a?: IncubationFee, b?: IncubationFee) {
  return a?.component === b?.component && a?.treasury === b?.treasury && a?.amount === b?.amount;
}
