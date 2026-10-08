import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {temporaryFolder} from './temporary.ts';
import { WorldStore } from '../src/store.ts';
import { RULES, initialState } from '../src/domain.ts';
import type { Command } from '../src/domain.ts';
import { prepareStoredWork } from './helpers.ts';
import { WORK_DURATION } from '../src/jobs.ts';
const create: Command = { id: 'create_0001', type: 'CreateCitizen', payload: { name: 'Ada', state: 'Lagos', adultConfirmed: true } };

test('concurrent duplicated commands settle once and serial failures do not poison later commands', async () => {
  const store = await WorldStore.open();
  await store.dispatch('citizen-one', create, 100);
  await prepareStoredWork(store,'citizen-one',100);
  const shift: Command = { id: 'shift_00001', type: 'CompleteShift', payload: {} };
  const results = await Promise.all(Array.from({ length: 12 }, () => store.dispatch('citizen-one', shift, 100+WORK_DURATION)));
  assert.equal(results.filter(r => !r.replayed).length, 1);
  assert.equal(store.snapshot().balances['citizen:citizen-one'], RULES.starterCash + RULES.shiftPay);
  await assert.rejects(store.dispatch('citizen-one', { ...shift, id: 'shift_00002' }, 101+WORK_DURATION));
  await store.dispatch('citizen-one', { id: 'meal_00001', type: 'BuyBasicMeal', payload: {} }, 102+WORK_DURATION);
  assert.equal(store.snapshot().outbox.length, 7);
});
test('restart preserves balance, receipts and replay deduplication', async t => {
  const folder = await temporaryFolder('simulator-store-'); t.after(() => rm(folder, { recursive: true, force: true }));
  const file = join(folder, 'world.json'), store = await WorldStore.open(file);
  const original = await store.dispatch('citizen-one', create, 100);
  const reopened = await WorldStore.open(file);
  assert.deepEqual(reopened.snapshot(), store.snapshot());
  const replay = await reopened.dispatch('citizen-one', create, 9000);
  assert.deepEqual(replay.receipt, original.receipt); assert.equal(replay.replayed, true);
  assert.equal(reopened.snapshot().outbox.length, 1);
});
test('failed persistence does not confirm an in-memory mutation', async t => {
  const folder = await temporaryFolder('simulator-write-'); t.after(() => rm(folder, { recursive: true, force: true }));
  const blocker = join(folder, 'blocker'), store = await WorldStore.open(join(blocker, 'world.json'));
  await writeFile(blocker, 'not a directory');
  await assert.rejects(store.dispatch('citizen-one', create, 100));
  assert.equal(Object.keys(store.snapshot().citizens).length, 0);
  assert.equal(store.snapshot().outbox.length, 0);
});
test('corrupt snapshots fail visibly rather than resetting the world', async t => {
  const folder = await temporaryFolder('simulator-corrupt-'); t.after(() => rm(folder, { recursive: true, force: true }));
  const file = join(folder, 'world.json'); await writeFile(file, '{"version":9}');
  await assert.rejects(WorldStore.open(file), /Unsupported or corrupt/);
  const invalid = { ...initialState(), outbox: null }; await writeFile(file, JSON.stringify(invalid));
  await assert.rejects(WorldStore.open(file), /Unsupported or corrupt/);
});
