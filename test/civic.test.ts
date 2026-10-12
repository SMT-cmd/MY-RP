import test from 'node:test';
import assert from 'node:assert/strict';
import {execute,initialState,citizenView,DomainError,post} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {PETITION_RULES,civicRevision} from '../src/civic.ts';
import {reconcile,exportBackup,restoreBackup} from '../src/recovery.ts';
import {WorldStore} from '../src/store.ts';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const code=(c:string)=>(e:unknown)=>e instanceof DomainError&&e.code===c;
function fixture(){let s=initialState();for(let i=0;i<12;i++)s=execute(s,'actor-'+i,{id:'citizen_create_'+i,type:'CreateCitizen',payload:{name:'Citizen '+i,state:i===11?'Kano':'Lagos',adultConfirmed:true}},100).state;return s;}
const proposal={id:'petition_create_once',type:'CreateCivicPetition',payload:{topic:'roads',termsVersion:PETITION_RULES.version,consent:true}};
function action(s:State,actor:string,type:string,at=1000,id='civic_action_'+Object.keys(s.commands).length){const p=Object.values(s.civic!.petitions)[0];return execute(s,actor,{id,type,payload:{petitionId:p.id,petitionVersion:p.version,termsVersion:p.termsVersion,consent:true}},at);}
function threshold(){let s=execute(fixture(),'actor-0',proposal,1000).state;for(let i=1;i<10;i++)s=action(s,'actor-'+i,'SupportCivicPetition').state;return s;}
test('petitions authenticate jurisdiction and exact consent; duplicate/replayed support changes no money or office permissions',()=>{
 const s=fixture();assert.throws(()=>execute(s,'actor-0',{...proposal,payload:{...proposal.payload,consent:false}},1000),code('CIVIC_CONSENT'));
 assert.throws(()=>execute(s,'actor-0',{...proposal,payload:{...proposal.payload,termsVersion:'forged'}},1000),code('CIVIC_CONSENT'));
 assert.throws(()=>execute(s,'actor-0',{...proposal,payload:{...proposal.payload,topic:'mint money'}},1000),code('PETITION_TOPIC'));
 let next=execute(s,'actor-0',proposal,1000).state;const balances=structuredClone(next.balances),journals=structuredClone(next.journals);
 assert.throws(()=>action(next,'actor-11','SupportCivicPetition'),code('CIVIC_JURISDICTION'));assert.throws(()=>action(next,'actor-0','SupportCivicPetition'),code('ALREADY_SUPPORTED'));assert.throws(()=>action(next,'actor-1','WithdrawCivicPetition'),code('PETITION_AUTHOR'));
 assert.throws(()=>execute(next,'actor-1',{...proposal,id:'duplicate_topic_once'},1000),code('PETITION_EXISTS'));assert.throws(()=>execute(next,'actor-0',{...proposal,id:'rate_limit_once',payload:{...proposal.payload,topic:'water'}},1001),code('PETITION_RATE_LIMIT'));
 const p=Object.values(next.civic!.petitions)[0],c={id:'support_same_request',type:'SupportCivicPetition',payload:{petitionId:p.id,petitionVersion:1,termsVersion:p.termsVersion,consent:true,actorId:'actor-0',region:'Kano'}};
 assert.throws(()=>execute(next,'actor-1',{...c,id:'support_without_consent',payload:{...c.payload,consent:false}},1000),code('CIVIC_CONSENT'));
 const result=execute(next,'actor-1',c,1000);next=result.state;assert.equal(p.version,1);assert.equal(Object.values(next.civic!.petitions)[0].members['actor-1'].changes.length,1);assert.equal(execute(next,'actor-1',c,500000).replayed,true);
 assert.throws(()=>execute(next,'actor-2',{...c,id:'stale_petition_once'},1000),code('PETITION_CHANGED'));assert.throws(()=>execute(next,'actor-1',{...c,payload:{...c.payload,consent:false}},1000),code('IDEMPOTENCY_CONFLICT'));
 assert.deepEqual(next.balances,balances);assert.deepEqual(next.journals,journals);assert.equal(next.administration,undefined);assert.deepEqual(citizenView(next,'actor-11',1000).civic!.petitions,[]);reconcile(next);
});
test('threshold notice occurs once; same-clock withdrawal/re-support retain notice and delayed consideration is a finite non-spending record',()=>{
 let s=threshold();const p=Object.values(s.civic!.petitions)[0],notice=structuredClone(p.notice),balances=structuredClone(s.balances),journals=structuredClone(s.journals);
 assert.ok(notice);assert.throws(()=>action(s,'actor-0','ReviewCivicPetition',1001),code('CIVIC_REVIEW_PENDING'));
 s=action(s,'actor-9','WithdrawCivicSupport').state;s=action(s,'actor-9','SupportCivicPetition').state;s=action(s,'actor-9','WithdrawCivicSupport').state;assert.throws(()=>action(s,'actor-9','SupportCivicPetition'),code('CIVIC_CHANGE_LIMIT'));assert.equal(citizenView(s,'actor-9',1000).civic!.petitions![0].canSupport,false);s=action(s,'actor-10','SupportCivicPetition').state;
 assert.deepEqual(Object.values(s.civic!.petitions)[0].notice,notice);reconcile(s);
 const review=action(s,'actor-2','ReviewCivicPetition',1000+PETITION_RULES.reviewDelay);s=review.state;assert.deepEqual(review.receipt.detail.consideration,{at:1000+PETITION_RULES.reviewDelay,support:10,treasury:0,estimatedCost:100000,outcome:'funding-proposal-required'});
 assert.throws(()=>action(s,'actor-3','ReviewCivicPetition',1000+PETITION_RULES.reviewDelay),code('CIVIC_REVIEW_PENDING'));assert.throws(()=>action(s,'actor-9','SupportCivicPetition',1000+PETITION_RULES.reviewDelay),code('PETITION_CLOSED'));
 s=action(s,'actor-10','WithdrawCivicSupport',1000+PETITION_RULES.reviewDelay).state;assert.equal(Object.values(s.civic!.petitions)[0].review!.support,10);assert.deepEqual(s.balances,balances);assert.deepEqual(s.journals,journals);reconcile(s);
 const view=citizenView(s,'actor-3',1000+PETITION_RULES.reviewDelay).civic!;const json=JSON.stringify(view);for(const secret of ['actor-0','actor-9','support_same_request','sourceKey','members','changes','reviewKey'])assert.ok(!json.includes(secret));
 const minted=structuredClone(s);post(minted,'actor-0:petition_create_once:forged',1000,'Forged civic mint',[{account:'system:forged-civic',amount:-1},{account:'treasury:state:Lagos',amount:1}]);assert.throws(()=>reconcile(minted),/cannot move money/);
 const restored=restoreBackup(exportBackup(s));restored.commands=Object.fromEntries(Object.entries(restored.commands).reverse());reconcile(restored);
 for(const corrupt of [(x:State)=>Object.values(x.civic!.petitions)[0].version++, (x:State)=>Object.values(x.civic!.petitions)[0].review!.treasury=200000,(x:State)=>Object.values(x.civic!.petitions)[0].notice!.at++,(x:State)=>Object.values(x.civic!.petitions)[0].members['actor-9'].changes.pop()]){const x=structuredClone(s);corrupt(x);assert.throws(()=>reconcile(x),/Civic|civic/);}
});
test('expiry and author withdrawal close signing without destroying individual withdrawal or formal notice',()=>{
 let s=execute(fixture(),'actor-0',proposal,1000).state;const before=civicRevision(s,'actor-1',1000);assert.notEqual(civicRevision(s,'actor-1',1000+PETITION_RULES.window),before);assert.throws(()=>action(s,'actor-1','SupportCivicPetition',1000+PETITION_RULES.window),code('PETITION_CLOSED'));
 s=action(s,'actor-0','WithdrawCivicSupport',1000+PETITION_RULES.window).state;reconcile(s);
 s=threshold();s=action(s,'actor-0','WithdrawCivicPetition').state;s=action(s,'actor-4','ReviewCivicPetition',1000+PETITION_RULES.reviewDelay).state;assert.equal(Object.values(s.civic!.petitions)[0].review!.outcome,'withdrawn');s=action(s,'actor-1','WithdrawCivicSupport',1000+PETITION_RULES.reviewDelay).state;reconcile(s);
});
test('file restart preserves exact petition evidence and concurrent duplicate supports settle once',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'myrp-civic-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=join(dir,'world.json'),store=await WorldStore.open(file);
 for(let i=0;i<2;i++)await store.dispatch('actor-'+i,{id:'file_create_citizen',type:'CreateCitizen',payload:{name:'Citizen '+i,state:'Lagos',adultConfirmed:true}},100);
 await store.dispatch('actor-0',proposal,1000);const p=Object.values(store.snapshot().civic!.petitions)[0],c={id:'file_support_once',type:'SupportCivicPetition',payload:{petitionId:p.id,petitionVersion:1,termsVersion:p.termsVersion,consent:true}};
 const both=await Promise.all([store.dispatch('actor-1',c,1000),store.dispatch('actor-1',c,1000)]);assert.equal(both.filter(r=>r.replayed).length,1);
 const reopened=await WorldStore.open(file);assert.equal((await reopened.dispatch('actor-1',c,2000)).replayed,true);assert.equal(Object.values(reopened.snapshot().civic!.petitions)[0].version,2);reconcile(reopened.snapshot());
});

test('NPC consideration uses actual tax journals and preserves the recorded treasury when later revenue arrives',async()=>{
 const {graduate,completeCourse}=await import('./helpers.ts');let s=threshold();s=graduate(s,'actor-0',100);s=completeCourse(s,'actor-0','secondary',5*86400000);s=completeCourse(s,'actor-0','business',6*86400000);
 const at=7*86400000;for(let i=0;i<10;i++)s=execute(s,'actor-0',{id:'civic_funded_company_'+i,type:'RegisterCompany',payload:{name:'Road Supplier '+i,sector:'manufacturing',capital:100000}},at).state;
 assert.equal(s.balances['treasury:state:Lagos'],100000);const balances=structuredClone(s.balances),journals=structuredClone(s.journals);s=action(s,'actor-0','ReviewCivicPetition',at).state;
 assert.equal(Object.values(s.civic!.petitions)[0].review!.outcome,'formal-budget-review-required');assert.deepEqual(s.balances,balances);assert.deepEqual(s.journals,journals);reconcile(s);
 s=execute(s,'actor-0',{id:'civic_later_company',type:'RegisterCompany',payload:{name:'Later Revenue',sector:'manufacturing',capital:100000}},at).state;assert.equal(s.balances['treasury:state:Lagos'],110000);assert.equal(Object.values(s.civic!.petitions)[0].review!.treasury,100000);reconcile(restoreBackup(exportBackup(s)));
 const reduced=threshold();const lower=action(reduced,'actor-9','WithdrawCivicSupport').state;assert.equal(Object.values(action(lower,'actor-0','ReviewCivicPetition',1000+PETITION_RULES.reviewDelay).state.civic!.petitions)[0].review!.outcome,'insufficient-support');
});
