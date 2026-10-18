import { ActivationStore } from "./account-readiness.ts";
export const activations = new ActivationStore();
let queue: Promise<unknown> = Promise.resolve();
export function serializeWallet<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.catch(() => undefined).then(work);
  queue = run;
  return run;
}
