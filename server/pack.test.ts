import test from 'node:test';
import assert from 'node:assert/strict';
import { packCanines, fertility } from '../shared/pack.ts';
import { parentKey } from '../shared/canine-rules.ts';
import type { Canine, GameState } from '../shared/game.ts';
const c: Canine = { id: 'a'.repeat(32), resource: 'resource_' + 'b'.repeat(64), genes: 'EEEEEEEE', generation: 0, variant: 0, name: 'Canine' };
const breeding = { epoch: 1, parents: {}, minted: 0, requests: [] };
test('pack includes old/current stakes, deduplicates by collection and preserves actionable wallet inventory', () => {
 const other = { ...c, resource: 'resource_' + 'c'.repeat(64) };
 const state: GameState = { connected: true, network: 'Esmeralda', incubations: [], canines: [c], stakedCanines: [c, other, other] };
 assert.equal(packCanines(state).length, 2);
 assert.ok(packCanines(state).every(x => x.staked));
 assert.deepEqual(state.canines, [c]);
});
test('fertility distinguishes available, completed, reserved, terminal and unknown state', () => {
 assert.equal(fertility(c, breeding), 'Fertile');
 assert.equal(fertility(c, undefined), 'Fertility unavailable');
 assert.equal(fertility({ ...c, generation: 7 }, breeding), 'Sterile · generation O');
 const reserved = { ...breeding, parents: { [parentKey(c)]: 'request' }, requests: [{ id: 'request', first: c, second: c, targetEpoch: 3, status: 0, captured: false }] };
 assert.equal(fertility(c, reserved), 'Reserved for breeding');
 assert.equal(fertility(c, { ...reserved, requests: [{ ...reserved.requests[0], status: 1 }] }), 'Sterile · already bred');
 assert.equal(fertility(c, { ...reserved, requests: [] }), 'Already bred or reserved');
 assert.equal(fertility(c, { ...reserved, requests: [], parentStatuses: { [parentKey(c)]: 1 } }), 'Sterile · already bred');
});
