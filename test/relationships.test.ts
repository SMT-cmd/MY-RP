import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execute,initialState,citizenView,DomainError,DAY} from '../src/domain.ts';
import type {State,Command} from '../src/domain.ts';
import {RELATIONSHIP_RULES} from '../src/relationships.ts';
import type {Relationship} from '../src/relationships.ts';
import {publicCitizenReceipt} from '../src/public-receipts.ts';
import {recoveryCursor} from '../src/presence.ts';
import {reconcile,exportBackup,restoreBackup} from '../src/recovery.ts';
import {WorldStore} from '../src/store.ts';
let sequence=0;
const code=(c:string)=>(e:unknown)=>e instanceof DomainError&&e.code===c;
const run=(s:State,actor:string,type:string,payload:Record<string,unknown>={},at=1000)=>execute(s,actor,{id:'relationship_test_'+ ++sequence,type,payload},at);
function setup(){let s=initialState();for(const actor of ['social-ada','social-bola','social-chidi'])s=run(s,actor,'CreateCitizen',{name:actor.replace('social-','Citizen '),state:'Lagos',adultConfirmed:true}).state;return s;}
function invite(s:State,kind='friend',at=2000){s=run(s,'social-bola','SetPrivacy',{relationships:true},at-1).state;return run(s,'social-ada','InviteRelationship',{citizenId:s.citizens['social-bola'].id,kind,termsVersion:RELATIONSHIP_RULES.version,acceptTerms:true},at);}
function acceptance(r:Relationship):Command{return{id:'accept_relation_'+ ++sequence,type:'AcceptRelationship',payload:{relationshipId:r.id,relationshipVersion:r.version,kind:r.kind,senderCitizenId:'',acceptedExpiresAt:r.expiresAt,termsVersion:r.termsVersion,acceptTerms:true}};}
function accept(s:State,r:Relationship,at=3000){const c=acceptance(r);c.payload.senderCitizenId=s.citizens[r.sender].id;return execute(s,r.recipient,c,at);}
test('relationship request requires explicit inbox permission and exact mutual acceptance; retries preserve assets and confer no house access',()=>{
 let s=setup();const money={...s.balances},property=structuredClone(s.property),homes=structuredClone(s.furnishing),target=s.citizens['social-bola'].id;
 assert.throws(()=>run(s,'social-ada','InviteRelationship',{citizenId:target,kind:'friend',termsVersion:RELATIONSHIP_RULES.version,acceptTerms:true}),code('CONTACT_UNAVAILABLE'));
 const offered=invite(s),r=offered.receipt.detail.relationship as Relationship;s=offered.state;assert.equal(r.status,'invited');
 const command=acceptance(r);command.payload.senderCitizenId=s.citizens[r.sender].id;
 for(const changes of [{acceptTerms:false},{kind:'partner'},{senderCitizenId:s.citizens['social-chidi'].id},{acceptedExpiresAt:r.expiresAt+1},{termsVersion:'old'},{relationshipVersion:2}])assert.throws(()=>execute(s,'social-bola',{...command,id:'wrong_terms_'+ ++sequence,payload:{...command.payload,...changes}},3000),e=>e instanceof DomainError);
 assert.throws(()=>execute(s,'social-ada',command,3000),code('RELATIONSHIP_UNAVAILABLE'));assert.throws(()=>execute(s,'social-chidi',command,3000),code('RELATIONSHIP_UNAVAILABLE'));
 const accepted=execute(s,'social-bola',command,3000);s=accepted.state;assert.equal(s.relationships!.records[r.id].status,'active');assert.equal(execute(s,'social-bola',command,r.expiresAt+DAY).replayed,true);
 assert.equal(citizenView(s,'social-bola',r.expiresAt+DAY).relationships!.records[0].status,'active');assert.deepEqual(s.balances,money);assert.deepEqual(s.property,property);assert.deepEqual(s.furnishing,homes);assert.deepEqual(citizenView(s,'social-bola',4000).world!.guestEntrances,[]);assert.deepEqual(restoreBackup(exportBackup(s)),s);
});
test('friendship and partnership require independent consent, prevent reciprocal duplicate requests and either person can leave without another approval',()=>{
 let offered=invite(setup()),r=offered.receipt.detail.relationship as Relationship,s=accept(offered.state,r).state;
 const payload={citizenId:s.citizens['social-ada'].id,kind:'friend',termsVersion:RELATIONSHIP_RULES.version,acceptTerms:true};s=run(s,'social-ada','SetPrivacy',{relationships:true}).state;assert.throws(()=>run(s,'social-bola','InviteRelationship',payload),code('RELATIONSHIP_EXISTS'));
 offered=invite(s,'partner',4000);const partner=offered.receipt.detail.relationship as Relationship;s=offered.state;assert.equal(s.relationships!.records[partner.id].status,'invited');s=accept(s,partner,5000).state;
 s=run(s,'social-bola','EndRelationship',{relationshipId:partner.id,relationshipVersion:2},6000).state;assert.equal(s.relationships!.records[r.id].status,'active');assert.equal(s.relationships!.records[partner.id].closeReason,'left');
 s=run(s,'social-ada','EndRelationship',{relationshipId:r.id,relationshipVersion:2},7000).state;assert.equal(s.relationships!.records[r.id].status,'ended');reconcile(s);
});
test('decline and withdrawal are role restricted; expiry hides pending requests on reads and settles only with a successful new command',()=>{
 for(const [actor,type,reason] of [['social-bola','DeclineRelationship','declined'],['social-ada','WithdrawRelationship','withdrawn']]){const offered=invite(setup()),r=offered.receipt.detail.relationship as Relationship;assert.throws(()=>run(offered.state,'social-chidi',type,{relationshipId:r.id,relationshipVersion:1}),code('RELATIONSHIP_UNAVAILABLE'));const ended=run(offered.state,actor,type,{relationshipId:r.id,relationshipVersion:1},4000).state;assert.equal(ended.relationships!.records[r.id].closeReason,reason);reconcile(ended);}
 const offered=invite(setup()),r=offered.receipt.detail.relationship as Relationship,before=structuredClone(offered.state),v=citizenView(before,'social-bola',r.expiresAt);assert.equal(v.relationships!.records[0].closeReason,'expired');assert.deepEqual(offered.state,before);
 assert.throws(()=>accept(before,r,r.expiresAt),code('RELATIONSHIP_CHANGED'));assert.deepEqual(before,offered.state);
 const ended=run(before,'social-chidi','BuyBasicMeal',{},r.expiresAt);assert.equal(ended.state.relationships!.records[r.id].status,'ended');assert.equal((ended.receipt.detail.relationshipClosureProofs as string[]).length,1);assert.ok(!JSON.stringify(publicCitizenReceipt(ended.state,ended.receipt)).includes(r.id));reconcile(ended.state);
});
test('either block ends pending and active ties once, privacy closes only incoming requests, and unblocking never restores consent',()=>{
 for(const actor of ['social-ada','social-bola']){const offered=invite(setup()),r=offered.receipt.detail.relationship as Relationship;for(const state of [offered.state,accept(offered.state,r).state]){const before=structuredClone(state.balances),peer=actor==='social-ada'?'social-bola':'social-ada';let s=run(state,actor,'BlockCitizen',{citizenId:state.citizens[peer].id},5000).state;assert.equal(s.relationships!.records[r.id].closeReason,'blocked');s=run(s,actor,'UnblockCitizen',{citizenId:s.citizens[peer].id},6000).state;assert.equal(s.relationships!.records[r.id].status,'ended');assert.deepEqual(s.balances,before);reconcile(s);}}
 const offered=invite(setup()),r=offered.receipt.detail.relationship as Relationship;let s=run(offered.state,'social-bola','SetPrivacy',{relationships:false},4000).state;assert.equal(s.relationships!.records[r.id].closeReason,'privacy');reconcile(s);s=run(accept(offered.state,r).state,'social-bola','SetPrivacy',{relationships:false},4000).state;assert.equal(s.relationships!.records[r.id].status,'active');reconcile(s);
});
test('private relationship views and command/recovery receipts use citizen pseudonyms and omit consent keys and uninvolved records',()=>{
 const offered=invite(setup()),r=offered.receipt.detail.relationship as Relationship,result=accept(offered.state,r),s=result.state;
 assert.deepEqual(citizenView(s,'social-chidi',5000).relationships!.records,[]);
 for(const actor of ['social-ada','social-bola']){const text=JSON.stringify({relationships:citizenView(s,actor,5000).relationships,receipts:citizenView(s,actor,5000).receipts,recovery:recoveryCursor(s,actor,0)});for(const privateValue of [actor==='social-ada'?'social-bola':'social-ada','sourceKey','acceptedKey','closedKey','relationshipClosureProofs'])assert.ok(!text.includes(privateValue));}
 assert.equal((publicCitizenReceipt(s,result.receipt).detail.relationship as {sender:string}).sender,s.citizens['social-ada'].id);
});
test('rolling request limits survive withdrawal, pending capacity is bounded, and historical recovery rejects forged consent or closure',()=>{
 let s=setup();s=run(s,'social-bola','SetPrivacy',{relationships:true}).state;
 for(let i=0;i<20;i++){const result=run(s,'social-ada','InviteRelationship',{citizenId:s.citizens['social-bola'].id,kind:'friend',termsVersion:RELATIONSHIP_RULES.version,acceptTerms:true},2000+i*2),r=result.receipt.detail.relationship as Relationship;s=run(result.state,'social-ada','WithdrawRelationship',{relationshipId:r.id,relationshipVersion:1},2001+i*2).state;}
 assert.throws(()=>invite(s,'friend',5000),code('RELATIONSHIP_RATE'));assert.ok(invite(s,'friend',2000+DAY).state.relationships);reconcile(s);
 const offered=invite(setup()),r=offered.receipt.detail.relationship as Relationship,accepted=accept(offered.state,r).state;
 for(const alter of [(x:State)=>x.relationships!.records[r.id].recipient='social-chidi',(x:State)=>x.relationships!.records[r.id].acceptedKey='social-chidi:fake_command',(x:State)=>x.relationships!.records[r.id].status='ended',(x:State)=>x.relationships!.records[r.id].expiresAt++]){const forged=structuredClone(accepted);alter(forged);assert.throws(()=>reconcile(forged),/Relationship/);}
});
test('failed file save preserves pending consent, reopening recovers once, and concurrent end/block cannot resurrect a relationship',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'myrp-relationship-')),file=join(dir,'world.json');t.after(()=>rm(dir,{recursive:true,force:true}));const offered=invite(setup()),r=offered.receipt.detail.relationship as Relationship;await writeFile(file,JSON.stringify(offered.state));const store=await WorldStore.open(file),c=acceptance(r);c.payload.senderCitizenId=offered.state.citizens[r.sender].id;
 await mkdir(file+'.tmp');await assert.rejects(store.dispatch(r.recipient,c,3000));assert.deepEqual(store.snapshot(),offered.state);await rm(file+'.tmp',{recursive:true});await store.dispatch(r.recipient,c,3000);const reopened=await WorldStore.open(file);assert.equal((await reopened.dispatch(r.recipient,c,4000)).replayed,true);
 await Promise.allSettled([reopened.dispatch(r.sender,{id:'end_relation_concurrent',type:'EndRelationship',payload:{relationshipId:r.id,relationshipVersion:2}},5000),reopened.dispatch(r.recipient,{id:'block_relation_concurrent',type:'BlockCitizen',payload:{citizenId:offered.state.citizens[r.sender].id}},5001)]);const saved=(await WorldStore.open(file)).snapshot();assert.equal(saved.relationships!.records[r.id].status,'ended');reconcile(saved);
});
test('request capacity includes both senders and recipients and cannot be widened by payload limits or reciprocal requests',()=>{
 let s=setup();s=run(s,'social-bola','SetPrivacy',{relationships:true}).state;s=run(s,'social-ada','SetPrivacy',{relationships:true}).state;
 for(let i=0;i<20;i++){const actor='capacity-person-'+i;s=run(s,actor,'CreateCitizen',{name:'Neighbour '+i,state:'Lagos',adultConfirmed:true}).state;s=run(s,actor,'InviteRelationship',{citizenId:s.citizens['social-bola'].id,kind:'friend',termsVersion:RELATIONSHIP_RULES.version,acceptTerms:true},2000+i).state;}
 const before=structuredClone(s);assert.throws(()=>run(s,'social-ada','InviteRelationship',{citizenId:s.citizens['social-bola'].id,kind:'partner',termsVersion:RELATIONSHIP_RULES.version,acceptTerms:true,maxPending:999},3000),code('RELATIONSHIP_CAPACITY'));assert.deepEqual(s,before);
 assert.throws(()=>run(s,'social-bola','InviteRelationship',{citizenId:s.citizens['social-ada'].id,kind:'friend',termsVersion:RELATIONSHIP_RULES.version,acceptTerms:true},3000),code('RELATIONSHIP_CAPACITY'));reconcile(s);
 const first=Object.values(s.relationships!.records)[0];s=run(s,'social-bola','DeclineRelationship',{relationshipId:first.id,relationshipVersion:1},4000).state;assert.ok(invite(s,'partner',5000).state.relationships);reconcile(s);
});
