import test from 'node:test';
import assert from 'node:assert/strict';
import {execute,initialState,DomainError,DAY,citizenView} from '../src/domain.ts';
import type {State,Command} from '../src/domain.ts';
import {ADMIN_RULES,adminAccess,adminView,staffGrants} from '../src/admin.ts';
import {reconcile,exportBackup,restoreBackup} from '../src/recovery.ts';
import {WorldStore} from '../src/store.ts';
import {temporaryFolder} from './temporary.ts';
import {join} from 'node:path';
import {rm} from 'node:fs/promises';
const roots=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'],third='00000000-0000-4000-8000-000000000003';
const at=1000000,why='Independent operator reviewed exact permissions';
const session=(actor:string,time=at)=>({sessionId:'session-'+actor,assurance:'aal2' as const,stepUpAt:time});
const code=(name:string)=>(e:unknown)=>e instanceof DomainError&&e.code===name;
let sequence=0;
const cmd=(type:string,payload:Record<string,unknown>={}):Command=>({id:'admin_test_'+ ++sequence,type,payload});
function boot(){return execute(initialState(),'bootstrap-operator',cmd('BootstrapStaff',{actors:roots,reason:why}),at,{bootstrap:true}).state;}
function run(s:State,actor:string,type:string,payload:Record<string,unknown>,time=at){return execute(s,actor,cmd(type,{adminVersion:s.administration!.version,...payload}),time,{session:session(actor,time)});}
function propose(s:State,payload:Record<string,unknown>){const next=run(s,roots[0],'ProposeStaffChange',{reason:why,...payload}).state;return{state:next,proposal:Object.values(next.administration!.proposals).at(-1)!};}
function approve(s:State,id:string){const p=s.administration!.proposals[id];return run(s,roots[1],'DecideStaffChange',{proposalId:id,proposalVersion:p.version,signature:p.signature,approve:true,reason:why}).state;}
function apply(s:State,id:string,actor=roots[0]){const p=s.administration!.proposals[id];return run(s,actor,'ApplyStaffChange',{proposalId:id,proposalVersion:p.version,signature:p.signature}).state;}
function grant(s:State,actor:string,role:string,region:string|null=null){const p=propose(s,{action:'grant',targetActorId:actor,role,region,grantUntil:at+DAY});return apply(approve(p.state,p.proposal.id),p.proposal.id);}
test('trusted bootstrap records exactly two independent grant authorities without provisioning citizens or funds',()=>{
 assert.throws(()=>execute(initialState(),roots[0],cmd('BootstrapStaff',{actors:roots,reason:why}),at),code('STAFF_PERMISSION'));
 for(const actors of [[roots[0]],[roots[0],roots[0]],['bad',roots[1]]])assert.throws(()=>execute(initialState(),'bootstrap-operator',cmd('BootstrapStaff',{actors,reason:why}),at,{bootstrap:true}),code('STAFF_BOOTSTRAP'));
 const s=boot();reconcile(s);assert.equal(Object.keys(s.citizens).length,0);assert.equal(s.journals.length,0);assert.deepEqual(s.balances,{});assert.equal(s.administration!.audit.length,1);
 assert.throws(()=>execute(s,'bootstrap-operator',cmd('BootstrapStaff',{actors:roots,reason:why}),at,{bootstrap:true}),code('STAFF_ALREADY_CONFIGURED'));
 assert.equal(adminView(s,roots[0],session(roots[0]),at).availability,null);
 assert.equal(adminView(s,roots[0],session(roots[0]),at).economy.length,0);
});
test('staff authority ignores game titles and requires recent verified MFA before reads, writes and replays',()=>{
 const s=boot(),c=cmd('ProposeStaffChange',{adminVersion:1,action:'grant',targetActorId:roots[1],role:'support',region:'Lagos',grantUntil:at+DAY,reason:why});
 assert.throws(()=>execute(s,third,c,at,{session:session(third)}),code('STAFF_PERMISSION'));
 for(const stepUpAt of [undefined,at+1,at-ADMIN_RULES.stepUp,1.5]){
  const auth={...session(roots[0]),stepUpAt};assert.equal(adminAccess(s,roots[0],auth,at).stepUpRequired,true);
  assert.throws(()=>adminView(s,roots[0],auth,at),code('STAFF_STEP_UP'));
 }
 assert.throws(()=>execute(s,roots[0],c,at,{session:{...session(roots[0]),assurance:'aal1'}}),code('STAFF_STEP_UP'));
 const result=execute(s,roots[0],c,at,{session:session(roots[0])});assert.equal(execute(result.state,roots[0],c,at,{session:session(roots[0])}).replayed,true);
 assert.throws(()=>execute(result.state,roots[0],c,at+ADMIN_RULES.stepUp,{session:session(roots[0])}),code('STAFF_STEP_UP'));
 assert.deepEqual(citizenView(result.state,roots[0],at).receipts,[]);
});
test('staff changes require exact terms, a second current actor and bounded non-self grants',()=>{
 const s=boot(),p=propose(s,{action:'grant',targetActorId:roots[1],role:'economy',region:'Lagos',grantUntil:at+DAY});
 assert.equal(staffGrants(p.state,roots[1],at).length,1);
 const exact={proposalId:p.proposal.id,proposalVersion:1,signature:p.proposal.signature,approve:true,reason:why};
 assert.throws(()=>run(p.state,roots[0],'DecideStaffChange',exact),code('STAFF_INDEPENDENT_APPROVAL'));
 assert.throws(()=>run(p.state,roots[1],'DecideStaffChange',{...exact,signature:'changed'}),code('STAFF_TERMS_CHANGED'));
 assert.throws(()=>run(p.state,roots[0],'ApplyStaffChange',exact),code('STAFF_APPROVALS'));
 const ready=approve(p.state,p.proposal.id);assert.throws(()=>run(ready,roots[0],'ApplyStaffChange',exact),code('STAFF_TERMS_CHANGED'));
 const applied=apply(ready,p.proposal.id);reconcile(applied);assert.equal(staffGrants(applied,roots[1],at).length,2);
 assert.deepEqual(adminView(applied,roots[1],session(roots[1]),at).economy,[{region:'Lagos',treasury:0,citizens:0}]);
 for(const bad of [{targetActorId:roots[0]},{region:'Unknown'},{role:'technical',region:'Lagos'},{grantUntil:at+31*DAY}])assert.throws(()=>propose(s,{action:'grant',targetActorId:roots[1],role:'support',region:null,grantUntil:at+DAY,...bad}));
 assert.throws(()=>propose(applied,{action:'grant',targetActorId:roots[1],role:'support',region:null,grantUntil:at+DAY}),code('STAFF_ROLE_LIMIT'));
 assert.throws(()=>run(ready,roots[0],'ApplyStaffChange',{proposalId:p.proposal.id,proposalVersion:2,signature:p.proposal.signature},at+ADMIN_RULES.proposalTTL),code('STAFF_PROPOSAL_CLOSED'));
 const revoked=structuredClone(ready);revoked.sessions={version:1,leases:{},revoked:{['session-'+roots[1]]:{actor:roots[1],at}}} as State['sessions'];
 assert.throws(()=>apply(revoked,p.proposal.id),code('STAFF_APPROVALS'));
});
test('independent revocation preserves two authorities and revoked staff cannot replay old actions',()=>{
 let s=boot();const p=propose(s,{action:'revoke',grantId:'staff-root-1',grantVersion:1});
 assert.throws(()=>apply(approve(p.state,p.proposal.id),p.proposal.id),code('STAFF_AUTHORITY_MINIMUM'));
 s=execute(s,third,cmd('CreateCitizen',{name:'Timi',state:'Lagos',adultConfirmed:true}),at).state;s=grant(s,third,'super');
 const old=cmd('ProposeStaffChange',{adminVersion:s.administration!.version,action:'grant',targetActorId:roots[1],role:'support',region:null,grantUntil:at+DAY,reason:why});s=execute(s,roots[0],old,at,{session:session(roots[0])}).state;
 const revoke=propose(s,{action:'revoke',grantId:'staff-root-1',grantVersion:1});s=apply(approve(revoke.state,revoke.proposal.id),revoke.proposal.id);reconcile(s);
 assert.equal(staffGrants(s,roots[0],at).length,0);assert.throws(()=>execute(s,roots[0],old,at,{session:session(roots[0])}),code('STAFF_PERMISSION'));
 assert.deepEqual(adminAccess(s,roots[0],session(roots[0]),at).roles,[]);
});
test('staff audit hashes detect mutation, survive backup and file restart, and settled retries add no audit record',async t=>{
 const dir=await temporaryFolder('admin-store-');t.after(()=>rm(dir,{recursive:true,force:true}));const file=join(dir,'world.json'),store=await WorldStore.open(file,{requireConnection:true});
 await store.bootstrapStaff(roots,why,at);const s=store.snapshot(),command=cmd('ProposeStaffChange',{adminVersion:1,action:'grant',targetActorId:roots[1],role:'support',region:null,grantUntil:at+DAY,reason:why}),context={administration:{session:session(roots[0])}};
 const result=await store.dispatch(roots[0],command,at,session(roots[0]).sessionId,context),reopened=await WorldStore.open(file,{requireConnection:true});
 assert.deepEqual((await reopened.dispatch(roots[0],command,at+1,session(roots[0]).sessionId,context)).receipt,result.receipt);assert.equal(reopened.snapshot().administration!.audit.length,2);
 assert.deepEqual(restoreBackup(exportBackup(reopened.snapshot(),at)),reopened.snapshot());
 const altered=structuredClone(s);altered.administration!.audit[0].reason='Changed operator';assert.throws(()=>reconcile(altered),/Staff audit/);
 const unsupported=structuredClone(s);unsupported.administration!.grants['staff-root-1'].role='economy';assert.throws(()=>reconcile(unsupported),/matching audit/);
});
