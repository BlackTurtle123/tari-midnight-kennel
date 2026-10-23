import { test } from "node:test";
import assert from "node:assert/strict";
import { TransactionBuilder, Network, resourceAddressLiteral, intLiteral, stringLiteral, componentAddressLiteral } from "@tari-project/ootle";
import { intentId, playerInstructions } from "../shared/external-wallet.ts";
import { readIncubationPayments } from "./external-chain.ts";
const component = "component_" + "ab".repeat(32), account = "component_" + "cd".repeat(32);
const fee = { component: "component_" + "11".repeat(32), treasury: "component_" + "22".repeat(32), amount: 20_000_000 };

test("treasury fee instructions withdraw once and pass the entire bucket into the atomic reservation", () => {
  const id = "ab".repeat(16);
  const expected = TransactionBuilder.new(Network.Esmeralda, 0)
    .callMethod({ componentAddress: account as `component_${string}`, methodName: "withdraw" }, [resourceAddressLiteral(("resource_" + "01".repeat(32)) as `resource_${string}`), intLiteral(20_000_000n)])
    .saveVar("fee")
    .callMethod({ componentAddress: fee.component as `component_${string}`, methodName: "begin_incubation" }, [stringLiteral(id), componentAddressLiteral(account as `component_${string}`), intLiteral(1n), { Workspace: "fee" }])
    .buildUnsignedTransaction().instructions;
  assert.deepEqual(playerInstructions(component, id, { kind: "begin", account, door: 1, fee }), expected);
  assert.equal(playerInstructions(component, id, { kind: "hatch", variant: 1, salt: "00".repeat(32) }).length, 1);
  assert.throws(() => playerInstructions(component, id, { kind: "begin", account, door: 1, fee: { ...fee, amount: 1 } }));
});

test("signed intent binds treasury, gateway and exact amount; old fee-free ids remain distinct", async () => {
  const intent = { component, account, paymentAddress: "otl_esm_testaddress", door: 1, nonce: "00".repeat(32) };
  const paid = await intentId({ ...intent, fee });
  assert.notEqual(paid, await intentId(intent));
  assert.notEqual(paid, await intentId({ ...intent, fee: { ...fee, treasury: account } }));
  assert.notEqual(paid, await intentId({ ...intent, fee: { ...fee, component } }));
  await assert.rejects(intentId({ ...intent, fee: { ...fee, amount: 1 } }));
});

test("payment receipts require the deployed template, original game, treasury, exact fee and recipient", () => {
  const tag = (v: string) => ({ "@cbor": "tag", tag: 128, value: { "@cbor": "bytes", hex: v.slice(10) } });
  const template = "ef".repeat(32), config = { ...fee, template, game: component };
  const raw = { header: { template_address: template }, body: { state: [tag(component), tag(fee.treasury), fee.amount, { ["ab".repeat(16)]: tag(account) }] } };
  assert.equal(readIncubationPayments(raw, config)["ab".repeat(16)], account);
  for (const changed of [{ ...config, template: "00".repeat(32) }, { ...config, game: account }, { ...config, treasury: account }, { ...config, amount: 1 }])
    assert.throws(() => readIncubationPayments(raw, changed));
});
