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
import {
  resourceAddressLiteral,
  componentAddressLiteral,
  intLiteral,
} from "@tari-project/ootle";
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
  legacyResource,
} from "../server/config.ts";

const deploymentPath = join(DATA_DIR, "rebirth-v1.json");
const current = deployment().resource;
const legacy = legacyResource() ?? current;
const stake = JSON.parse(
  readFileSync(join(DATA_DIR, "staking-v1.json"), "utf8"),
);
if (
  stake.network !== "esmeralda" ||
  stake.current !== current ||
  stake.legacy !== legacy ||
  !/^component_[a-f0-9]{64}$/.test(stake.component)
)
  throw new Error("Invalid staking deployment");
const fee = 8_000_000;
if (existsSync(deploymentPath)) {
  console.log(`Already deployed; preserving ${deploymentPath}.`);
  process.exit(0);
}
mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const logPath = join(DATA_DIR, "rebirth-v1-deployment-journal.jsonl");
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
    "rebirth-contract/target/wasm32-unknown-unknown/release/arkimals_rebirth.wasm",
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
      resourceAddressLiteral(current as `resource_${string}`),
      resourceAddressLiteral(legacy as `resource_${string}`),
      componentAddressLiteral(stake.component),
      componentAddressLiteral(operator.account.component_address),
      intLiteral(BigInt(fee)),
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
const resource = created.Accept.up_substates.find(
  ([, s]) =>
    "Resource" in s.substate &&
    s.substate.Resource.metadata.name === "Arkimals Halloween Rebirth",
)?.[0];
if (!component || !resource)
  throw new Error("Missing game component or canine resource in receipt");
writeFileSync(
  deploymentPath,
  JSON.stringify(
    {
      network: "esmeralda",
      current,
      legacy,
      template,
      component,
      resource,
      staking: stake.component,
      fee,
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
  `Deployed ${component}\nCanine collection ${resource}\nConfiguration: ${deploymentPath}`,
);
