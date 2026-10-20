import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import { componentAddressLiteral } from "@tari-project/ootle";
import {
  wallet,
  submit,
  waitAccepted,
  constructorInstructions,
} from "../server/wallet.ts";
import {
  DATA_DIR,
  OPERATOR_NAME,
  TARI_RESOURCE,
  deployment,
} from "../server/config.ts";

const deploymentPath = join(DATA_DIR, "incubation-treasury-v1.json");
const game = deployment();
if (existsSync(deploymentPath)) {
  console.log(`Already deployed; preserving ${deploymentPath}.`);
  process.exit(0);
}
mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const logPath = join(DATA_DIR, "incubation-treasury-v1-deployment-journal.jsonl");
const log: Record<string, string> = existsSync(logPath)
  ? Object.assign(
      {},
      ...readFileSync(logPath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l)),
    )
  : {};
function remember(key: string, value: string) {
  const fd = openSync(logPath, "a", 0o600);
  try {
    writeSync(fd, JSON.stringify({ [key]: value }) + "\n");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  log[key] = value;
}
const client = await wallet();
const operator = await client.accountsGet({
  name_or_address: { Name: OPERATOR_NAME },
});
if (operator.account.component_address !== game.operator)
  throw new Error("Operator account differs from the existing game; refusing treasury change");
if (!log.publicationTx) {
  if (log.publicationSubmittingAt)
    throw new Error(
      "Publication acknowledgement missing; reconcile wallet receipts before retrying.",
    );
  const balances = await client.accountsGetBalances({
    account: { Name: OPERATOR_NAME },
    refresh: true,
  });
  const revealed = BigInt(
    balances.balances.find((b) => b.resource_address === TARI_RESOURCE)
      ?.balance ?? 0,
  );
  // Reserve one tTARI for component creation; do not require 100 tTARI just to estimate a small publication.
  const available = revealed - 1_000_000n;
  if (available <= 0n)
    throw new Error(
      "Operator needs more than 1 revealed tTARI for publication and component creation.",
    );
  const publicationBudget = Number(
    available < 100_000_000n ? available : 100_000_000n,
  );
  const binary = readFileSync(
    "treasury-contract/target/wasm32-unknown-unknown/release/arkimals_incubation_treasury.wasm",
  ).toString("base64");
  const estimate = await client.publishTemplate({
    binary,
    fee_account: { Name: OPERATOR_NAME },
    max_fee: publicationBudget,
    detect_inputs: true,
    dry_run: true,
    metadata: null,
  });
  if (!estimate.dry_run_fee)
    throw new Error("Publication fee estimate unavailable");
  const fee = Math.ceil(estimate.dry_run_fee * 1.5) + 10_000;
  if (fee > publicationBudget)
    throw new Error(
      "Publication estimate exceeds the available operator balance or 100 tTARI cap",
    );
  console.log(`Publishing template; fee budget ${fee} microtari.`);
  remember("publicationSubmittingAt", new Date().toISOString());
  const sent = await client.publishTemplate({
    binary,
    fee_account: { Name: OPERATOR_NAME },
    max_fee: fee,
    detect_inputs: true,
    dry_run: false,
    metadata: null,
  });
  remember("publicationTx", sent.transaction_id);
}
const publication = await waitAccepted(log.publicationTx);
const pubResult = publication.result!.result;
if (!("Accept" in pubResult)) throw new Error("Publication rejected");
const template = pubResult.Accept.up_substates.find(
  ([, s]) => "Template" in s.substate,
)?.[0];
if (!template) throw new Error("No template in publication receipt");
if (!log.creationTx) {
  if (log.creationSubmittingAt)
    throw new Error(
      "Component creation acknowledgement missing; reconcile wallet receipts before retrying.",
    );
  remember("creationSubmittingAt", new Date().toISOString());
  const sent = await submit(
    OPERATOR_NAME,
    constructorInstructions(template, [
      componentAddressLiteral(game.component as `component_${string}`),
      componentAddressLiteral(operator.account.component_address),
    ]),
  );
  remember("creationTx", sent.transaction_id);
}
const creation = await waitAccepted(log.creationTx);
const created = creation.result!.result;
if (!("Accept" in created)) throw new Error("Creation rejected");
const component = created.Accept.up_substates.find(
  ([id, s]) =>
    "Component" in s.substate && id !== operator.account.component_address,
)?.[0];
if (!component) throw new Error("Missing treasury component in creation receipt");
const config = { template, component, game: game.component, treasury: game.operator, amount: 20_000_000 };
const { readIncubationPayments } = await import("../server/external-chain.ts");
const state = created.Accept.up_substates.find(([id]) => id === component)![1].substate;
if (!("Component" in state)) throw new Error("Invalid treasury component");
readIncubationPayments(state.Component, config);
writeFileSync(
  deploymentPath,
  JSON.stringify(
    {
      network: "esmeralda",
      template,
      component,
      game: game.component,
      treasury: game.operator,
      amount: 20_000_000,
      operator: operator.account.component_address,
      publicationTx: log.publicationTx,
      creationTx: log.creationTx,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
  { flag: "wx", mode: 0o600 },
);
console.log(
  `Deployed incubation treasury ${component}; 20 test tTARI per new incubation. Configuration: ${deploymentPath}`,
);
