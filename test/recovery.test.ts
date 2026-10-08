import test from 'node:test';
import assert from 'node:assert/strict';
import { execute,initialState } from '../src/domain.ts';
import { exportBackup,restoreBackup,reconcile } from '../src/recovery.ts';
import { prepareWork } from './helpers.ts';
import { WORK_DURATION } from '../src/jobs.ts';
test('verified restore preserves balances and receipts and replays do not pay again',()=>{
  const command={id:'backup_create_01',type:'CreateCitizen' as const,payload:{name:'Ada',state:'Lagos',adultConfirmed:true}};
  let state=execute(initialState(),'citizen-one',command,100).state;
  const shift={id:'backup_shift_01',type:'CompleteShift' as const,payload:{}};state=execute(prepareWork(state,'citizen-one',101),'citizen-one',shift,101+WORK_DURATION).state;
  const restored=restoreBackup(exportBackup(state));assert.deepEqual(restored,state);assert.equal(execute(restored,'citizen-one',shift,9999).replayed,true);
  const tampered=structuredClone(state);tampered.balances['citizen:citizen-one']++;
  assert.throws(()=>reconcile(tampered),/balance mismatch/);
  assert.throws(()=>restoreBackup({...exportBackup(state),data:JSON.stringify(tampered)}),/integrity/);
});
