import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, execute, citizenView, DAY, RULES, DomainError } from '../src/domain.ts';
import type { State, Command } from '../src/domain.ts';
import { prepareWork,finishModules,firstDay,examPayload } from './helpers.ts';
import { WORK_DURATION } from '../src/jobs.ts';

const start = 10 * DAY;
let sequence = 0;
const command = (type: Command['type'], payload: Record<string, unknown> = {}): Command => ({ id: `command_${++sequence}`, type, payload });
const create = () => command('CreateCitizen', { name: 'Ada Okafor', state: 'Lagos', adultConfirmed: true });
const apply = (state: State, cmd: Command, now = start, actor = 'citizen-one') => execute(state, actor, cmd, now);
const enrolled = () => apply(initialState(), create()).state;
const errorCode = (code: string) => (error: unknown) => error instanceof DomainError && error.code === code;
function graduatedModules() {
  return finishModules(enrolled(),'citizen-one',start);
}

test('onboarding commits citizen, shelter, balanced allowance and event together', () => {
  const original = initialState(), result = apply(original, create());
  assert.equal(Object.keys(original.citizens).length, 0);
  assert.equal(result.state.citizens['citizen-one'].housing, 'Starter accommodation');
  assert.equal(result.state.balances['citizen:citizen-one'], RULES.starterCash);
  assert.equal(result.state.journals.length, 1);
  assert.equal(result.state.journals[0].entries.reduce((sum, e) => sum + e.amount, 0), 0);
  assert.equal(result.state.outbox.length, 1);
});
test('invalid age confirmation and duplicate citizens do not mutate the world', () => {
  const original = initialState();
  const before=structuredClone(original);
  assert.throws(() => apply(original, command('CreateCitizen', { name: 'Ada', state: 'Lagos', adultConfirmed: false })), errorCode('ADULT_REQUIRED'));
  assert.deepEqual(original, before);
  assert.throws(() => apply(enrolled(), create()), errorCode('CITIZEN_EXISTS'));
});
test('replays return the original receipt without new money or events', () => {
  const first = apply(initialState(), create());
  const shift = command('CompleteShift');
  const paid = apply(prepareWork(first.state,'citizen-one',start), shift,start+WORK_DURATION);
  const replay = apply(paid.state, shift, start + DAY);
  assert.equal(replay.replayed, true); assert.deepEqual(replay.receipt, paid.receipt);
  assert.deepEqual(replay.state, paid.state);
});
test('a reused request id with a different payload is rejected', () => {
  const cmd = create(), done = apply(initialState(), cmd);
  assert.throws(() => apply(done.state, { ...cmd, payload: { ...cmd.payload, state: 'Kano' } }), errorCode('IDEMPOTENCY_CONFLICT'));
});
test('payload ordering does not change the idempotency fingerprint', () => {
  const cmd = create(), first = apply(initialState(), cmd);
  const second = apply(first.state, { ...cmd, payload: { adultConfirmed: true, state: 'Lagos', name: 'Ada Okafor' } });
  assert.equal(second.replayed, true);
});
test('authenticated actors cannot target somebody else through payload fields', () => {
  let state = enrolled(); state = apply(state, create(), start, 'citizen-two').state;
  const result = apply(state, command('BuyBasicMeal', { actorId: 'citizen-two', amount: 1 }));
  assert.equal(result.state.balances['citizen:citizen-two'], RULES.starterCash);
  assert.equal(result.state.balances['citizen:citizen-one'], RULES.starterCash - RULES.basicMealCost);
  const view = citizenView(result.state, 'citizen-one', start);
  assert.ok(view.receipts.every(r => r.actorId === 'citizen-one'));
  assert.ok(view.exam.every(q => !('correct' in q)));
});
test('starter work is immediate but cooldown and daily employer budget are enforced', () => {
  let state = enrolled(),time=start;
  state=apply(prepareWork(state,'citizen-one',time),command('CompleteShift'),time+WORK_DURATION).state;time+=WORK_DURATION;
  assert.throws(()=>apply(state,command('BeginWork',{jobId:'cleaner'}),time+RULES.shiftCooldown-1),errorCode('SHIFT_COOLDOWN'));
  for(let n=1;n<4;n++){time+=RULES.shiftCooldown;state=apply(prepareWork(state,'citizen-one',time),command('CompleteShift'),time+WORK_DURATION).state;time+=WORK_DURATION;}
  assert.throws(()=>apply(state,command('BeginWork',{jobId:'cleaner'}),time+RULES.shiftCooldown),errorCode('NPC_BUDGET_LIMIT'));
  state=apply(prepareWork(state,'citizen-one',start+DAY),command('CompleteShift'),start+DAY+WORK_DURATION).state;
  assert.equal(state.balances['citizen:citizen-one'], RULES.starterCash + 5 * RULES.shiftPay);
});
test('overspending fails without a receipt, partial debit or event', () => {
  let state = enrolled();
  for (let n = 0; n < RULES.starterCash / RULES.basicMealCost; n++) state = apply(state, command('BuyBasicMeal')).state;
  const before = structuredClone(state);
  assert.throws(() => apply(state, command('BuyBasicMeal')), errorCode('INSUFFICIENT_FUNDS'));
  assert.deepEqual(state, before);
  assert.equal(Object.values(state.balances).reduce((a, b) => a + b, 0), 0);
  assert.ok(state.journals.every(j => j.entries.reduce((a, e) => a + e.amount, 0) === 0));
});
test('lesson order and real elapsed time cannot be bypassed by command fields', () => {
  let state = enrolled();
  assert.throws(() => apply(state, command('CompleteLesson', { day: 2, now: start + DAY })), errorCode('LESSON_LOCKED'));
  assert.throws(() => apply(state, command('CompleteLesson', { day: 2 }), start + DAY), errorCode('PREREQUISITE_REQUIRED'));
  state = firstDay(state,'citizen-one',start);
  state = apply(state, command('CompleteLesson', { day: 1 }),start+70000).state;
  assert.throws(() => apply(state, command('CompleteLesson', { day: 2 }), start + DAY - 1), errorCode('LESSON_LOCKED'));
  assert.throws(()=>apply(state,command('CompleteLesson',{day:2}),start+DAY),errorCode('PRACTICAL_REQUIRED'));
});
test('exam failure requires review, retake is free and certification is single issue', () => {
  assert.throws(() => apply(enrolled(), command('SubmitExam', { answers: [] })), errorCode('EXAM_LOCKED'));
  const now=start+4*DAY;let state=graduatedModules();const balance=state.balances['citizen:citizen-one'];
  state=apply(state,command('SubmitExam',examPayload(state,'citizen-one',false)),now).state;
  assert.equal(state.citizens['citizen-one'].certificate,null);
  assert.throws(()=>apply(state,command('SubmitExam',examPayload(state,'citizen-one')),now),errorCode('REVIEW_REQUIRED'));
  state=apply(state,command('CompleteLesson',{day:5}),now).state;
  const pass=command('SubmitExam',examPayload(state,'citizen-one'));state=apply(state,pass,now).state;
  assert.ok(state.citizens['citizen-one'].certificate);assert.equal(state.citizens['citizen-one'].examAttempts.length,2);
  assert.equal(state.balances['citizen:citizen-one'],balance);assert.equal(apply(state,pass,now+DAY).replayed,true);
  assert.throws(()=>apply(state,command('SubmitExam',examPayload(state,'citizen-one')),now),errorCode('ALREADY_CERTIFIED'));
});
test('unknown actions and malformed examination answers fail without side effects', () => {
  const state = graduatedModules(), before = structuredClone(state);
  assert.throws(() => apply(state, { ...command('BuyBasicMeal'), type: 'GrantMoney' as Command['type'] }), errorCode('UNKNOWN_COMMAND'));
  assert.throws(() => apply(state, command('SubmitExam', { answers: [0, 1] }), start + 4 * DAY), errorCode('INVALID_EXAM'));
  assert.deepEqual(state, before);
});
test('malformed record references cannot reach inherited object properties or mutate state',()=>{
 const state=initialState(),before=JSON.stringify(state);
 for(const reference of ['__proto__','constructor','prototype'])assert.throws(()=>execute(state,'citizen-one',{id:'invalid_reference_'+reference.replace(/_/g,'x'),type:'ReservePropertyPurchase',payload:{saleId:reference}},100),(e:unknown)=>e instanceof DomainError&&e.code==='INVALID_REFERENCE');
 assert.equal(JSON.stringify(state),before);
});
