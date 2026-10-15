import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { join } from "node:path";
import { intLiteral } from "@tari-project/ootle";
import {
  wallet,
  submit,
  waitAccepted,
  constructorInstructions,
} from "../server/wallet.ts";
import { DATA_DIR, OPERATOR_NAME, deploymentPath } from "../server/config.ts";

if (existsSync(deploymentPath)) {
  console.log(`Already deployed; preserving ${deploymentPath}.`);
  process.exit(0);
}
mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const logPath = join(DATA_DIR, "deployment-journal.jsonl");
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
  appendFileSync(logPath, JSON.stringify({ [key]: value }) + "\n", {
    mode: 0o600,
  });
  log[key] = value;
}
const client = await wallet();
const operator = await client.accountsGet({
  name_or_address: { Name: OPERATOR_NAME },
});
if (!log.publicationTx) {
  const binary = readFileSync(
    "contract/target/wasm32-unknown-unknown/release/midnight_kennel.wasm",
  ).toString("base64");
  const estimate = await client.publishTemplate({
    binary,
    fee_account: { Name: OPERATOR_NAME },
    max_fee: 100_000_000,
    detect_inputs: true,
    dry_run: true,
    metadata: null,
  });
  if (!estimate.dry_run_fee)
    throw new Error("Publication fee estimate unavailable");
  const fee = Math.ceil(estimate.dry_run_fee * 1.5) + 10_000;
  if (fee > 100_000_000)
    throw new Error("Publication exceeds the 100 tTARI PoC budget");
  console.log(`Publishing template; fee budget ${fee} microtari.`);
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
  const sent = await submit(
    OPERATOR_NAME,
    constructorInstructions(template, [intLiteral(100n)]),
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
    s.substate.Resource.metadata.name === "Midnight Kennel Canines",
)?.[0];
if (!component || !resource)
  throw new Error("Missing game component or canine resource in receipt");
writeFileSync(
  deploymentPath,
  JSON.stringify(
    {
      network: "esmeralda",
      template,
      component,
      resource,
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
