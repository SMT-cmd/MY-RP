import test from 'node:test';
import assert from 'node:assert/strict';
import { execute,initialState,citizenView,DAY,DomainError } from '../src/domain.ts';
import type { State } from '../src/domain.ts';
import { REGIONS } from '../src/geography.ts';
import { familyBand } from '../src/life.ts';
import { reconcile } from '../src/recovery.ts';
let sequence=0;const now=100*DAY;
const run=(state:State,actor:string,type:string,payload:Record<string,unknown>={},time=now)=>execute(state,actor,{id:'life_command_'+ ++sequence,type,payload},time);
const create=(state:State,actor:string,path='independent',region='Lagos')=>run(state,actor,'CreateCitizen',{name:actor,state:region,path,adultConfirmed:true}).state;
const rejects=(code:string)=>(error:unknown)=>error instanceof DomainError&&error.code===code;
test('all 37 regions support one atomic citizen bundle and private seed stays private',()=>{
  let state=initialState();for(const [i,region] of REGIONS.entries()){const actor='citizen-'+i;state=create(state,actor,'independent',region.name);const view=citizenView(state,actor,now);assert.equal(view.citizen?.state,region.name);assert.ok(view.life?.phone);assert.equal(view.life?.household,null);assert.ok(!JSON.stringify(view).includes(state.life!.seed));}
  assert.equal(Object.keys(state.citizens).length,37);assert.equal(new Set(Object.values(state.citizens).map(c=>c.id)).size,37);reconcile(state);
});
test('family distribution is reproducible and matches the published balance seed',()=>{
  const counts:Record<string,number>={};for(let i=0;i<20000;i++){const band=familyBand('distribution-test-seed','actor-'+i);counts[band]=(counts[band]??0)+1;assert.equal(band,familyBand('distribution-test-seed','actor-'+i));}
  for(const [band,target] of [['struggling',.2],['working-class',.35],['middle-class',.3],['upper-middle-class',.12],['wealthy',.03]] as const)assert.ok(Math.abs(counts[band]/20000-target)<.01,band);
});
test('random family assignment is durable and cannot be rerolled or bypass certification',()=>{
  const state=create(initialState(),'citizen-one','random-family'),c=state.citizens['citizen-one'],view=citizenView(state,'citizen-one',now);
  assert.ok(view.life?.household?.band);assert.equal(view.life?.household?.adults.length,2);assert.equal(c.certificate,null);const before=structuredClone(state);
  assert.throws(()=>create(state,'citizen-one','random-family'),rejects('CITIZEN_EXISTS'));assert.deepEqual(state,before);reconcile(state);
});
test('household invitations require consent and cannot debit a member’s personal funds',()=>{
  let state=create(create(initialState(),'citizen-owner'),'citizen-member');const ownerFunds=state.balances['citizen:citizen-owner'],memberFunds=state.balances['citizen:citizen-member'];
  state=run(state,'citizen-owner','CreateHousehold',{name:'Unity home',consent:true}).state;
  const invitation=run(state,'citizen-owner','InviteHousehold',{citizenId:state.citizens['citizen-member'].id});state=invitation.state;const invitationId=invitation.receipt.detail.invitationId;
  assert.throws(()=>run(state,'citizen-owner','AcceptHousehold',{invitationId,consent:true}),rejects('INVITATION_NOT_FOUND'));
  assert.throws(()=>run(state,'citizen-member','AcceptHousehold',{invitationId}),rejects('CONSENT_REQUIRED'));
  state=run(state,'citizen-member','AcceptHousehold',{invitationId,consent:true}).state;
  assert.equal(state.balances['citizen:citizen-member'],memberFunds);
  state=run(state,'citizen-member','ContributeHousehold',{amount:10000,consent:true}).state;
  assert.throws(()=>run(state,'citizen-member','WithdrawHousehold',{amount:10000,consent:true}),rejects('ROLE_REQUIRED'));
  assert.throws(()=>run(state,'citizen-owner','WithdrawHousehold',{amount:10001,consent:true}),rejects('INSUFFICIENT_FUNDS'));
  state=run(state,'citizen-owner','WithdrawHousehold',{amount:5000,consent:true,actorId:'citizen-member'}).state;
  assert.equal(state.balances['citizen:citizen-member'],memberFunds-10000);assert.equal(state.balances['citizen:citizen-owner'],ownerFunds+5000);
  state=run(state,'citizen-member','LeaveHousehold').state;assert.equal(state.citizens['citizen-member'].housing,'Starter accommodation');assert.equal(state.citizens['citizen-member'].life?.householdId,null);reconcile(state);
});
test('blocking prevents household contact and expired invitations cannot join',()=>{
  let state=create(create(initialState(),'citizen-owner'),'citizen-member');state=run(state,'citizen-owner','CreateHousehold',{name:'Unity home',consent:true}).state;
  state=run(state,'citizen-member','BlockCitizen',{citizenId:state.citizens['citizen-owner'].id}).state;
  assert.throws(()=>run(state,'citizen-owner','InviteHousehold',{citizenId:state.citizens['citizen-member'].id}),rejects('CONTACT_BLOCKED'));
  state=run(state,'citizen-member','UnblockCitizen',{citizenId:state.citizens['citizen-owner'].id}).state;
  const invite=run(state,'citizen-owner','InviteHousehold',{citizenId:state.citizens['citizen-member'].id});state=invite.state;
  assert.throws(()=>run(state,'citizen-member','AcceptHousehold',{invitationId:invite.receipt.detail.invitationId,consent:true},now+8*DAY),rejects('INVITATION_CLOSED'));
});
test('offline needs, treatment and family shocks are capped with no secret personal debit',()=>{
  let state=create(initialState(),'citizen-one','random-family');const before=structuredClone(state),funds=state.balances['citizen:citizen-one'];
  const absent=citizenView(state,'citizen-one',now+90*DAY);assert.ok(absent.life?.offlineSummary);assert.ok(absent.life!.needs.hunger>=20);assert.ok(absent.life!.needs.health>=60);assert.deepEqual(state,before);
  const family=run(state,'citizen-one','ReviewFamilyPeriod',{},now+90*DAY);state=family.state;assert.equal(state.balances['citizen:citizen-one'],funds);assert.throws(()=>run(state,'citizen-one','ReviewFamilyPeriod',{},now+90*DAY),rejects('PERIOD_SETTLED'));
  const house=state.life!.households[state.citizens['citizen-one'].life!.householdId!];assert.ok((family.receipt.detail.loss as number)<=(before.balances['household:'+house.id]??0)*.1);
  state=run(state,'citizen-one','RequestFamilyAllowance',{},now+90*DAY).state;assert.throws(()=>run(state,'citizen-one','RequestFamilyAllowance',{},now+90*DAY),rejects('ALLOWANCE_SETTLED'));
  state=run(state,'citizen-one','RequestBasicCare',{},now+90*DAY).state;assert.equal(state.citizens['citizen-one'].life?.needs.health,100);reconcile(state);
});
