import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {rm} from 'node:fs/promises';
import {WorldStore} from '../src/store.ts';
import {initialState,execute,DomainError} from '../src/domain.ts';
import {claimClient,assertClientLease,renewClient,releaseClient,SESSION_RULES} from '../src/sessions.ts';
import {nearbyPresence,recoveryCursor,PRESENCE_RULES} from '../src/presence.ts';
import {temporaryFolder} from './temporary.ts';
const claim=()=>({id:randomUUID(),claimId:randomUUID()});
const create={id:'session_create_001',type:'CreateCitizen',payload:{name:'Ada',state:'Lagos',adultConfirmed:true}};
const code=(expected:string)=>(error:unknown)=>error instanceof DomainError&&error.code===expected;

test('tab incarnations fence stale writers; same-claim retry, explicit takeover, TTL and capacity are bounded',()=>{
 const s=initialState(),first=claim(),second=claim(),a=claimClient(s,'citizen-one','session-one',first,false,100);
 assert.deepEqual(claimClient(s,'citizen-one','session-one',first,false,101).clientLease,a.clientLease);
 assert.throws(()=>claimClient(s,'citizen-one','session-one',second,false,102),code('CLIENT_IN_USE'));
 const duplicate=claimClient(s,'citizen-one','session-one',{...first,claimId:randomUUID()},false,103);
 assert.equal(duplicate.clientLease.epoch,2);assert.throws(()=>assertClientLease(s,'citizen-one','session-one',a.clientLease,104),code('CLIENT_LEASE_REQUIRED'));
 const takeover=claimClient(s,'citizen-one','session-two',second,true,104);assert.equal(takeover.clientLease.epoch,3);
 assert.throws(()=>renewClient(s,'citizen-one','session-one',duplicate.clientLease,105),code('CLIENT_LEASE_REQUIRED'));
 releaseClient(s,'citizen-one','session-two',takeover.clientLease,106);
 const afterRelease=claimClient(s,'citizen-one','session-one',first,false,107);assert.equal(afterRelease.clientLease.epoch,4);
 assert.throws(()=>assertClientLease(s,'citizen-one','session-one',afterRelease.clientLease,107+SESSION_RULES.ttl),code('CLIENT_LEASE_REQUIRED'));
 const afterExpiry=claimClient(s,'citizen-one','session-one',second,false,107+SESSION_RULES.ttl);assert.equal(afterExpiry.clientLease.epoch,5);
 const full=initialState();for(let i=0;i<SESSION_RULES.maxActive;i++)claimClient(full,'actor-'+i,'session-'+i,claim(),false,100);
 assert.throws(()=>claimClient(full,'actor-extra','session-extra',claim(),false,101),code('WORLD_AT_CAPACITY'));
 assert.equal(claimClient(full,'actor-extra','session-extra',claim(),false,100+SESSION_RULES.ttl).clientLease.epoch,1);
});

test('concurrent file-store claims and financial commands persist one authority; settled retries survive takeover and restart',async t=>{
 const folder=await temporaryFolder('session-store-');t.after(()=>rm(folder,{recursive:true,force:true}));const file=join(folder,'world.json'),store=await WorldStore.open(file,{requireConnection:true});
 const claims=await Promise.allSettled([claim(),claim()].map(id=>store.claimClient('citizen-one','session-one',id,false,100)));
 assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);const result=claims.find(r=>r.status==='fulfilled');if(result?.status!=='fulfilled')throw Error();const first=result.value.clientLease;
 await assert.rejects(store.dispatch('citizen-one',create,101,'session-one'),code('CLIENT_LEASE_REQUIRED'));assert.equal(store.snapshot().outbox.length,0);
 const created=await store.dispatch('citizen-one',create,102,'session-one',{clientLease:first}),meal={id:'session_meal_001',type:'BuyBasicMeal',payload:{}};
 const paid=await store.dispatch('citizen-one',meal,103,'session-one',{clientLease:first});
 const second=(await store.claimClient('citizen-one','session-two',claim(),true,104)).clientLease;
 await assert.rejects(store.dispatch('citizen-one',{...meal,id:'session_stale_meal'},105,'session-one',{clientLease:first}),code('CLIENT_LEASE_REQUIRED'));
 const retry=await store.dispatch('citizen-one',meal,105,'session-one',{clientLease:first});assert.equal(retry.replayed,true);assert.deepEqual(retry.receipt,paid.receipt);
 const reopened=await WorldStore.open(file,{requireConnection:true});assert.deepEqual(reopened.snapshot(),store.snapshot());
 assert.equal((await reopened.dispatch('citizen-one',create,106,'session-two',{clientLease:second})).replayed,true);assert.equal(reopened.snapshot().outbox.length,2);
 assert.deepEqual(recoveryCursor(reopened.snapshot(),'citizen-one',0).receipts,[created.receipt,paid.receipt]);
 await reopened.revokeSession('citizen-one','session-two');await assert.rejects(reopened.dispatch('citizen-one',meal,107,'session-two',{clientLease:second}),code('SESSION_REVOKED'));
 assert.throws(()=>reopened.snapshot('citizen-one','session-two'),code('SESSION_REVOKED'));assert.equal((await WorldStore.open(file)).snapshot().sessions!.leases['citizen-one'].status,'released');
});

test('presence reveals only nearby opted-in street citizens and respects both blocks, private interiors, travel and revoked leases',()=>{
 let s=initialState();const actor='viewer-one';s=execute(s,actor,create,100).state;const viewer=claimClient(s,actor,'viewer-session',claim(),false,100).clientLease;
 for(let i=0;i<40;i++){
  const peer='peer-'+i;s=execute(s,peer,{...create,id:'peer_create_'+i,payload:{...create.payload,name:'Neighbour '+i}},100).state;
  claimClient(s,peer,'peer-session-'+i,claim(),false,100);s.citizens[peer].life!.privacy={dm:false,location:true,presence:true};
 }
 let frame=nearbyPresence(s,actor,'viewer-session',viewer,101);assert.equal(frame.people.length,PRESENCE_RULES.maxVisible);
 assert.deepEqual(Object.keys(frame.people[0]).sort(),['avatar','facing','id','name','x','y']);assert.ok(!JSON.stringify(frame).includes('peer-session'));
 s.citizens['peer-0'].life!.privacy.location=false;s.citizens['peer-1'].life!.privacy.presence=false;
 s.life!.blocks[actor]=['peer-2'];s.life!.blocks['peer-3']=[actor];s.world!.positions['peer-4'].region='Abuja';s.world!.positions['peer-5'].interior='shelter';
 s.world!.positions['peer-6'].x+=PRESENCE_RULES.radius+1;s.sessions!.leases['peer-7'].expiresAt=101;s.sessions!.revoked['peer-session-8']={actor:'peer-8',at:101};
 frame=nearbyPresence(s,actor,'viewer-session',viewer,101);assert.equal(frame.people.length,31);
 for(let i=0;i<9;i++)assert.ok(!frame.people.some(p=>p.name==='Neighbour '+i));
 s.world!.positions[actor].interior='shelter';assert.deepEqual(nearbyPresence(s,actor,'viewer-session',viewer,101).people,[]);
 const own=recoveryCursor(s,actor,0);assert.equal(own.receipts.length,1);assert.equal(own.receipts[0]!.actorId,actor);assert.equal(recoveryCursor(s,actor,999).reset,true);
 assert.throws(()=>recoveryCursor(s,actor,-1));assert.throws(()=>recoveryCursor(s,actor,'secret'));
});
