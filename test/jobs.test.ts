import test from 'node:test';
import assert from 'node:assert/strict';
import { execute,initialState,DomainError,RULES,DAY } from '../src/domain.ts';
import type { State } from '../src/domain.ts';
import { STARTER_JOBS,WORK_DURATION,STEP_INTERVAL } from '../src/jobs.ts';
import { prepareWork } from './helpers.ts';
import { reconcile } from '../src/recovery.ts';
let id=0;const start=20*DAY;
const run=(s:State,type:string,payload:Record<string,unknown>={},now=start,actor='citizen-one')=>execute(s,actor,{id:'job_command_'+ ++id,type,payload},now);
const created=()=>run(initialState(),'CreateCitizen',{name:'Ada',state:'Lagos',adultConfirmed:true}).state;
const code=(c:string)=>(e:unknown)=>e instanceof DomainError&&e.code===c;
test('all ten NPC starter jobs reserve wages and award verified skill without credentials',()=>{
  for(const job of STARTER_JOBS){const ready=prepareWork(created(),'citizen-one',start,job.id);assert.equal(ready.balances['citizen:citizen-one'],RULES.starterCash);assert.equal(ready.balances['escrow:'+ready.life!.work!.active['citizen-one']],RULES.shiftPay);
    const paid=run(ready,'CompleteShift',{},start+WORK_DURATION).state;assert.equal(paid.balances['citizen:citizen-one'],RULES.starterCash+RULES.shiftPay);assert.equal(paid.citizens['citizen-one'].life!.skills[job.skill],1);assert.equal(paid.citizens['citizen-one'].certificate,null);reconcile(paid);
  }
});
test('instant, incorrect, forged and repeated completions do not create wages',()=>{
  let state=created();assert.throws(()=>run(state,'CompleteShift'),code('WORK_REQUIRED'));
  state=run(state,'BeginWork',{jobId:'cleaner'}).state;const before=structuredClone(state);
  assert.throws(()=>run(state,'WorkStep',{choice:0,now:start+STEP_INTERVAL}),code('TASK_COOLDOWN'));
  assert.throws(()=>run(state,'WorkStep',{choice:2},start+STEP_INTERVAL),code('TASK_REVIEW'));
  assert.throws(()=>run(state,'WorkStep',{choice:0,shiftId:'another-actor'},start+STEP_INTERVAL),code('INVALID_SHIFT'));assert.deepEqual(state,before);
  for(const [i,task] of STARTER_JOBS[0].tasks.entries())state=run(state,'WorkStep',{choice:task.correct},start+(i+1)*STEP_INTERVAL).state;
  assert.throws(()=>run(state,'CompleteShift',{now:start+WORK_DURATION},start+WORK_DURATION-1),code('SHIFT_TOO_EARLY'));
  const command={id:'pay_job_once_01',type:'CompleteShift',payload:{}};const paid=execute(state,'citizen-one',command,start+WORK_DURATION);const replay=execute(paid.state,'citizen-one',command,start+30*DAY);assert.equal(replay.replayed,true);assert.deepEqual(replay.state,paid.state);
  assert.throws(()=>run(paid.state,'CompleteShift',{},start+WORK_DURATION),code('WORK_REQUIRED'));
});
test('cancelling unearned work releases funds but completed checks preserve the earned wage',()=>{
  let state=run(created(),'BeginWork',{jobId:'cleaner'}).state;state=run(state,'CancelWork').state;
  assert.equal(state.balances['citizen:citizen-one'],RULES.starterCash);assert.ok(Object.values(state.life!.work!.reserved).every(n=>n===0));assert.ok(Object.entries(state.balances).filter(([key])=>key.startsWith('escrow:')).every(([,value])=>value===0));reconcile(state);
  state=prepareWork(state,'citizen-one',start);assert.throws(()=>run(state,'CancelWork',{},start+WORK_DURATION),code('EARNED_WORK'));
  state=run(state,'CompleteShift',{},start+30*DAY).state;assert.equal(state.balances['citizen:citizen-one'],RULES.starterCash+RULES.shiftPay);reconcile(state);
});
