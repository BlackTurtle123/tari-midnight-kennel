// Additive deployment: reuses the verified v1 templates, never replaces the founding pool.
import {
  existsSync,
  readFileSync,
  writeFileSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import {
  componentAddressLiteral,
  resourceAddressLiteral,
  intLiteral,
} from "@tari-project/ootle";
import {
  DATA_DIR,
  OPERATOR_NAME,
  breedingDeployment,
  rebirthDeployment,
} from "../server/config.ts";
import {
  wallet,
  submit,
  waitAccepted,
  constructorInstructions,
} from "../server/wallet.ts";
const bred = breedingDeployment();
const original = rebirthDeployment();
if (!bred || !original)
  throw new Error("Activate breeding and original economy first");
const originalStake = JSON.parse(
  readFileSync(join(DATA_DIR, "staking-v1.json"), "utf8"),
);
if (
  originalStake.component !== original.staking ||
  !/^template_[a-f0-9]{64}$/.test(originalStake.template)
)
  throw new Error("Original staking template mismatch");
const client = await wallet();
const operator = (
  await client.accountsGet({ name_or_address: { Name: OPERATOR_NAME } })
).account.component_address;
for (const kind of ["staking", "rebirth"] as const) {
  const path = join(DATA_DIR, `offspring-${kind}-v1.json`);
  if (existsSync(path)) {
    console.log(`Preserving ${path}`);
    continue;
  }
  const journal = join(
    DATA_DIR,
    `offspring-${kind}-v1-deployment-journal.jsonl`,
  );
  const log = existsSync(journal)
    ? Object.assign(
        {},
        ...readFileSync(journal, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l)),
      )
    : {};
  const remember = (key: string, value: string) => {
    const fd = openSync(journal, "a", 0o600);
    try {
      writeSync(fd, JSON.stringify({ [key]: value }) + "\n");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    log[key] = value;
  };
  const template =
    kind === "staking" ? originalStake.template : original.template;
  const staking =
    kind === "rebirth"
      ? JSON.parse(
          readFileSync(join(DATA_DIR, "offspring-staking-v1.json"), "utf8"),
        ).component
      : undefined;
  if (!log.creationTx) {
    if (log.creationSubmittingAt)
      throw new Error(
        "Submission acknowledgement missing: reconcile before retrying",
      );
    const args = [
      resourceAddressLiteral(bred.resource as `resource_${string}`),
      resourceAddressLiteral(bred.resource as `resource_${string}`),
    ];
    if (staking) args.push(componentAddressLiteral(staking));
    args.push(componentAddressLiteral(operator));
    if (kind === "rebirth") args.push(intLiteral(BigInt(original.fee)));
    remember("creationSubmittingAt", new Date().toISOString());
    const sent = await submit(
      OPERATOR_NAME,
      constructorInstructions(template, args),
    );
    remember("creationTx", sent.transaction_id);
  }
  const receipt = (await waitAccepted(log.creationTx)).result!.result;
  if (!("Accept" in receipt)) throw new Error("Component creation rejected");
  const component = receipt.Accept.up_substates.find(
    ([id, s]) => "Component" in s.substate && id !== operator,
  )?.[0];
  const resource = receipt.Accept.up_substates.find(
    ([, s]) =>
      "Resource" in s.substate &&
      s.substate.Resource.metadata.name === "Arkimals Halloween Rebirth",
  )?.[0];
  if (!component || (kind === "rebirth" && !resource))
    throw new Error("Missing deployment receipt outputs");
  writeFileSync(
    path,
    JSON.stringify(
      {
        network: "esmeralda",
        current: bred.resource,
        legacy: bred.resource,
        template,
        component,
        resource,
        staking,
        fee: original.fee,
        operator,
        treasury: operator,
        creationTx: log.creationTx,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  console.log(`Activated offspring ${kind}: ${component}`);
}
