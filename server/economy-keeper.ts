import { NotSubmitted } from "./submission-errors.ts";
import {
  existsSync,
  readFileSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import { DATA_DIR, OPERATOR_NAME, rebirthDeployment } from "./config.ts";
import { economySnapshot } from "./external-chain.ts";
import { submit, waitAccepted } from "./wallet.ts";
import { serializeWallet } from "./wallet-queue.ts";

// Only public consensus hashes are captured. Durable markers prevent duplicate fee spending.
export async function captureNeededEpoch() {
  const config = rebirthDeployment();
  if (!config) return;
  return serializeWallet(async () => {
    const state = await economySnapshot();
    if (
      !state?.requests.some(
        (r) => r.status === 0 && !r.captured && r.targetEpoch === state.epoch,
      )
    )
      return;
    const path = join(DATA_DIR, "rebirth-epoch-captures-v1.jsonl");
    const records = existsSync(path)
      ? readFileSync(path, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l))
      : [];
    const prior = records
      .filter(
        (r) => r.component === config.component && r.epoch === state.epoch,
      )
      .at(-1);
    if (prior && !prior.notSubmitted) {
      if (prior.transactionId) await waitAccepted(prior.transactionId);
      return;
    }
    const record = {
      component: config.component,
      epoch: state.epoch,
      createdAt: new Date().toISOString(),
      transactionId: undefined as string | undefined,
      notSubmitted: false,
    };
    const save = () => {
      const fd = openSync(path, "a", 0o600);
      try {
        writeSync(fd, JSON.stringify(record) + "\n");
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    };
    save();
    let tx;
    try {
      tx = await submit(OPERATOR_NAME, [
        {
          CallMethod: {
            call: { Address: config.component as `component_${string}` },
            method: "capture_epoch",
            args: [],
          },
        },
      ]);
    } catch (error) {
      if (error instanceof NotSubmitted) {
        record.notSubmitted = true;
        save();
      }
      throw error;
    }
    record.transactionId = tx.transaction_id;
    save();
    await waitAccepted(tx.transaction_id);
  });
}
export function startEconomyKeeper() {
  const tick = () =>
    void captureNeededEpoch().catch(() =>
      console.error(
        "Rebirth epoch capture is pending; existing request retained.",
      ),
    );
  tick();
  const interval = setInterval(tick, 30_000);
  interval.unref();
}
