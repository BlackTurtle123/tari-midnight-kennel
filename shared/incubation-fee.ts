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
  return fee;
}
export function sameIncubationFee(a?: IncubationFee, b?: IncubationFee) {
  return a?.component === b?.component && a?.treasury === b?.treasury && a?.amount === b?.amount;
}
