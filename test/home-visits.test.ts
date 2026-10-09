import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {execute,initialState,citizenView,DomainError} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {homeFor,residenceEntrance} from '../src/furnishing.ts';
import {HOME_VISIT_RULES,homeVisitsView} from '../src/home-visits.ts';
import {claimClient} from '../src/sessions.ts';
import {nearbyPresence} from '../src/presence.ts';
import {reconcile,exportBackup,restoreBackup} from '../src/recovery.ts';
import {walkTo} from './helpers.ts';
import {temporaryFolder} from './temporary.ts';
import {WorldStore} from '../src/store.ts';
import {recoveryCursor} from '../src/presence.ts';
let sequence=0;
const run=(s:State,actor:string,type:string,payload:Record<string,unknown>={},now=50000)=>execute(s,actor,{id:'home_visit_test_'+ ++sequence,type,payload},now);
const code=(expected:string)=>(e:unknown)=>e instanceof DomainError&&e.code===expected;
function setup(privateHome=false){
 let s=initialState();for(const [actor,name] of [['visit-host','Amina'],['visit-guest','Bola'],['visit-other','Chidi']])s=run(s,actor,'CreateCitizen',{name,state:'Lagos',adultConfirmed:true},100).state;
 if(privateHome){const p=run(s,'visit-host','ReservePropertyPurchase',{propertyId:'npc-Lagos-home',acceptedTotal:512500,acceptTerms:true});s=run(p.state,'visit-host','CompletePropertyPurchase',{purchaseId:p.receipt.detail.purchaseId}).state;}
 const e=residenceEntrance(s,'visit-host');s=walkTo(s,'visit-host',e.door.x,e.door.y+1,31000);s=walkTo(s,'visit-guest',e.door.x,e.door.y+1,31000);
 return run(s,'visit-host','EnterBuilding',{buildingId:e.id},40000).state;
}
function invite(s:State,guest='visit-guest',now=41000){const home=homeFor(s,'visit-host');return run(s,'visit-host','InviteHomeVisit',{citizenId:s.citizens[guest].id,homeVersion:home.version,leaseVersion:s.world!.positions['visit-host'].leaseVersion,durationMinutes:15,termsVersion:HOME_VISIT_RULES.version,acceptTerms:true},now);}
function accept(s:State,id:string,guest='visit-guest',now=42000){const v=s.furnishing!.visits![id];return run(s,guest,'AcceptHomeVisit',{visitId:id,visitVersion:v.version,homeId:v.homeId,acceptedExpiresAt:v.expiresAt,termsVersion:v.termsVersion,acceptTerms:true},now);}
function enter(s:State,id:string,guest='visit-guest',now=43000){return run(s,guest,'EnterBuilding',{buildingId:'visit:'+id,leaseVersion:s.world!.positions[guest].leaseVersion},now);}
function visiting(privateHome=false){const offered=invite(setup(privateHome)),v=offered.receipt.detail.visit as {id:string};return{id:v.id,state:enter(accept(offered.state,v.id).state,v.id).state};}

test('home invitation binds exact resident, guest consent, entrance and expiry; guests use shared furnishings without title or wardrobe authority',()=>{
 const offered=invite(setup(true)),v=offered.receipt.detail.visit as {id:string},id=v.id,s=offered.state,record=s.furnishing!.visits![id];
 assert.throws(()=>enter(s,id),code('INVALID_BUILDING'));
 assert.throws(()=>run(s,'visit-other','AcceptHomeVisit',{visitId:id,visitVersion:1}),code('VISIT_UNAVAILABLE'));
 assert.throws(()=>run(s,'visit-guest','AcceptHomeVisit',{visitId:id,visitVersion:1,homeId:record.homeId,acceptedExpiresAt:record.expiresAt+1,termsVersion:record.termsVersion,acceptTerms:true}),code('VISIT_TERMS'));
 const consent={id:'home_consent_once',type:'AcceptHomeVisit',payload:{visitId:id,visitVersion:1,homeId:record.homeId,acceptedExpiresAt:record.expiresAt,termsVersion:record.termsVersion,acceptTerms:true}};
 let next=execute(s,'visit-guest',consent,42000).state;assert.equal(execute(next,'visit-guest',consent,42001).replayed,true);assert.equal(next.world!.positions['visit-guest'].interior,null);
 next=enter(next,id).state;const view=citizenView(next,'visit-guest',43001);assert.equal(view.world!.home!.id,record.homeId);assert.equal(view.world!.home!.guest,true);assert.equal(view.world!.home!.address,'1 Market Lane');assert.ok(view.world!.home!.fixtures.every(f=>f.allowed===HOME_VISIT_RULES.actions.includes(f.action)));assert.ok(view.furnishing!.items.every(i=>i.owner===view.citizen!.id));assert.equal(view.homeVisits!.canInvite,false);
 const guest=next.world!.positions['visit-guest'];assert.equal(guest.leaseVersion,2);assert.ok(!guest.visited.includes('shelter'));
 next=run(next,'visit-guest','MoveInterior',{dx:1,dy:0,leaseVersion:2},44000).state;
 next=run(next,'visit-guest','MoveInterior',{dx:1,dy:0,leaseVersion:2},44700).state;
 next=run(next,'visit-guest','MoveInterior',{dx:0,dy:-1,leaseVersion:2},45400).state;
 next=run(next,'visit-guest','InteractHomeFixture',{fixtureId:'sofa',leaseVersion:2},45500).state;assert.equal(next.world!.positions['visit-guest'].activity!.kind,'Sit');
 for(const f of ['bed','pantry','wardrobe'])assert.throws(()=>run(next,'visit-guest','InteractHomeFixture',{fixtureId:f}),code('GUEST_PERMISSION'));
 const ownItem=homeFor(next,'visit-guest');assert.throws(()=>run(next,'visit-guest','CustomiseHome',{homeVersion:ownItem.version,wall:'navy',floor:'oak'}),code('HOME_REQUIRED'));
 assert.throws(()=>run(next,'visit-guest','ChangeAppearance',{}),code('HOME_REQUIRED'));
 assert.throws(()=>run(next,'visit-guest','InviteHomeVisit',{}),code('HOME_REQUIRED'));
 assert.deepEqual(restoreBackup(exportBackup(next)),next);reconcile(next);
 const outside=run(next,'visit-guest','ExitBuilding',{leaseVersion:2},47000).state;assert.equal(outside.world!.positions['visit-guest'].visitId,undefined);assert.equal(outside.furnishing!.visits![id].status,'accepted');assert.deepEqual([outside.world!.positions['visit-guest'].x,outside.world!.positions['visit-guest'].y],[27,7]);
});

test('expiry hides private room immediately, fences old location and commits safe exit once with private closure proofs',()=>{
 const {id,state}=visiting(),expires=state.furnishing!.visits![id].expiresAt,before=structuredClone(state),expired=citizenView(state,'visit-guest',expires);
 assert.equal(expired.world!.home,null);assert.equal(expired.world!.position.interior,null);assert.equal(expired.world!.position.leaseVersion,3);assert.deepEqual(expired.world!.guestEntrances,[]);assert.deepEqual(state,before);
 assert.throws(()=>run(state,'visit-guest','MoveInterior',{dx:1,dy:0,leaseVersion:2},expires),code('STALE_LEASE'));assert.deepEqual(state,before);
 const command={id:'expired_visit_move_once',type:'MoveCitizen',payload:{dx:1,dy:0,leaseVersion:3}},moved=execute(state,'visit-guest',command,expires);
 assert.equal(moved.state.furnishing!.visits![id].closeReason,'expired');assert.equal(moved.state.world!.positions['visit-guest'].leaseVersion,3);assert.equal(execute(moved.state,'visit-guest',command,expires+1).replayed,true);assert.equal(moved.state.world!.positions['visit-guest'].x,5);reconcile(moved.state);
 const endedByOther=run(state,'visit-other','BuyBasicMeal',{},expires),text=JSON.stringify(endedByOther.receipt);assert.ok(!text.includes(id));assert.ok(!text.includes(state.furnishing!.visits![id].homeId));assert.equal((endedByOther.receipt.detail.homeVisitClosureProofs as string[]).length,1);reconcile(endedByOther.state);
});

test('withdrawal, guest ending and either block eject only authorised visit occupants and keep an unconditional outside escape',()=>{
 for(const action of ['withdraw','leave','host-block','guest-block']){
  const {id,state}=visiting();const before={wallet:{...state.balances},title:structuredClone(state.property),items:structuredClone(state.furnishing!.items)},p=state.world!.positions['visit-guest'];
  const result=action==='withdraw'?run(state,'visit-host','WithdrawHomeVisit',{visitId:id,visitVersion:2}):action==='leave'?run(state,'visit-guest','EndHomeVisit',{visitId:id,visitVersion:2}):run(state,action==='host-block'?'visit-host':'visit-guest','BlockCitizen',{citizenId:state.citizens[action==='host-block'?'visit-guest':'visit-host'].id});
  const next=result.state;assert.equal(next.furnishing!.visits![id].status,'ended');assert.equal(next.world!.positions['visit-guest'].interior,null);assert.equal(next.world!.positions['visit-guest'].leaseVersion,p.leaseVersion+1);assert.equal(next.world!.positions['visit-host'].interior,'shelter');assert.deepEqual(next.balances,before.wallet);assert.deepEqual(next.property,before.title);assert.deepEqual(next.furnishing!.items,before.items);assert.throws(()=>enter(next,id),code('INVALID_BUILDING'));reconcile(next);
 }
});

test('resident moving ends invitations, a tenant keeps them through title transfer, and travelling alone does not grant a landlord entry',()=>{
 let {id,state:s}=visiting(true);s=run(s,'visit-host','ExitBuilding',{},44000).state;s=run(s,'visit-host','SetResidence',{propertyId:null,acceptTerms:true},45000).state;assert.equal(s.furnishing!.visits![id].closeReason,'residence-changed');assert.equal(s.world!.positions['visit-guest'].interior,null);reconcile(s);
 let rented=setup(true);rented=run(rented,'visit-host','ExitBuilding',{},41000).state;const offer=run(rented,'visit-host','OfferTenancy',{propertyId:'npc-Lagos-home',rent:10000,deposit:20000});rented=run(offer.state,'visit-guest','AcceptTenancy',{rentalId:offer.receipt.detail.rentalId,acceptedRent:10000,acceptedDeposit:20000,acceptTerms:true}).state;
 rented=run(rented,'visit-guest','EnterBuilding',{buildingId:'residence:npc-Lagos-home'},43000).state;const home=homeFor(rented,'visit-guest'),invited=run(rented,'visit-guest','InviteHomeVisit',{citizenId:rented.citizens['visit-other'].id,homeVersion:home.version,leaseVersion:2,durationMinutes:15,termsVersion:HOME_VISIT_RULES.version,acceptTerms:true}),rid=String((invited.receipt.detail.visit as {id:string}).id);
 rented=accept(invited.state,rid,'visit-other',50001).state;
 const sale=run(rented,'visit-host','ListProperty',{propertyId:'npc-Lagos-home',price:400000,acceptTerms:true});const reserved=run(sale.state,'visit-other','ReservePropertyPurchase',{saleId:sale.receipt.detail.saleId,acceptedTotal:410000,acceptTerms:true});rented=run(reserved.state,'visit-other','CompletePropertyPurchase',{purchaseId:reserved.receipt.detail.purchaseId}).state;
 assert.equal(rented.furnishing!.visits![rid].status,'accepted');assert.equal(citizenView(rented,'visit-host',55000).world!.residence.id,'shelter');assert.throws(()=>run(rented,'visit-host','EnterBuilding',{buildingId:'residence:npc-Lagos-home'}),code('INVALID_BUILDING'));reconcile(rented);
 // Ordinary regional travel retains a selected property and its existing consent.
 rented.world!.positions['visit-guest'].interior=null;delete rented.world!.positions['visit-guest'].homeId;delete rented.world!.positions['visit-guest'].interiorX;delete rented.world!.positions['visit-guest'].interiorY;rented.world!.positions['visit-guest'].region='Ogun';
 assert.equal(homeVisitsView(rented,'visit-other',55001)!.visits[0].status,'accepted');reconcile(rented);
});

test('guest scope isolates home presence, exact indoor coordinates, privacy, stale leases and closed visits',()=>{
 const {id,state:s}=visiting();let next=run(s,'visit-host','SetPrivacy',{presence:true,location:true}).state;next=run(next,'visit-guest','SetPrivacy',{presence:true,location:true}).state;next=run(next,'visit-other','SetPrivacy',{presence:true,location:true}).state;
 const fence=(actor:string)=>claimClient(next,actor,actor+'-session',{id:randomUUID(),claimId:randomUUID()},false,50000).clientLease;
 const host=fence('visit-host'),guest=fence('visit-guest');fence('visit-other');
 let frame=nearbyPresence(next,'visit-host','visit-host-session',host,50001);assert.equal(frame.people.length,1);assert.equal(frame.people[0].name,'Bola');assert.deepEqual([frame.people[0].x,frame.people[0].y],[4,6]);assert.equal(frame.scope!.homeId,next.furnishing!.visits![id].homeId);assert.ok(!JSON.stringify(frame.people).includes('visitId'));
 const street=nearbyPresence(next,'visit-other','visit-other-session',{clientId:next.sessions!.leases['visit-other'].clientId,epoch:1},50001);assert.deepEqual(street.people,[]);
 assert.equal(nearbyPresence(next,'visit-guest','visit-guest-session',guest,50001).people.length,1);
 next.citizens['visit-guest'].life!.privacy.presence=false;assert.deepEqual(nearbyPresence(next,'visit-host','visit-host-session',host,50002).people,[]);next.citizens['visit-guest'].life!.privacy.presence=true;
 next=run(next,'visit-host','WithdrawHomeVisit',{visitId:id,visitVersion:2},50003).state;assert.deepEqual(nearbyPresence(next,'visit-host','visit-host-session',host,50004).people,[]);assert.equal(nearbyPresence(next,'visit-guest','visit-guest-session',guest,50004).scope!.interior,null);
});

test('invitation review rejects duplicates, capacity, stale choices and forged terms, consent or home occupancy during recovery',()=>{
 let s=setup(),offered=invite(s),id=String((offered.receipt.detail.visit as {id:string}).id);s=offered.state;
 assert.throws(()=>invite(s),code('VISIT_EXISTS'));assert.throws(()=>run(s,'visit-host','WithdrawHomeVisit',{visitId:id,visitVersion:9}),code('VISIT_CHANGED'));
 s=run(s,'visit-guest','DeclineHomeVisit',{visitId:id,visitVersion:1}).state;assert.equal(s.furnishing!.visits![id].status,'declined');reconcile(s);
 for(let i=0;i<HOME_VISIT_RULES.maxActive;i++){const actor='capacity-'+i;s=run(s,actor,'CreateCitizen',{name:actor,state:'Lagos',adultConfirmed:true}).state;s=invite(s,actor).state;}
 s=run(s,'capacity-over','CreateCitizen',{name:'Extra guest',state:'Lagos',adultConfirmed:true}).state;assert.throws(()=>invite(s,'capacity-over'),code('VISIT_CAPACITY'));reconcile(s);
 const valid=visiting().state,vid=Object.keys(valid.furnishing!.visits!)[0];
 for(const modify of [(x:State)=>x.furnishing!.visits![vid].expiresAt++,(x:State)=>delete x.furnishing!.visits![vid].acceptedKey,(x:State)=>x.world!.positions['visit-other'].visitId=vid,(x:State)=>x.furnishing!.visits![vid].guest='visit-other']){const bad=structuredClone(valid);modify(bad);assert.throws(()=>reconcile(bad),/Home/);}
});

test('failed file persistence preserves consent and interior; concurrent withdrawal, stale movement and retry survive restart once',async t=>{
 const {id,state}=visiting(),folder=await temporaryFolder('home-visits-');t.after(()=>rm(folder,{recursive:true,force:true}));const file=join(folder,'world.json');await writeFile(file,JSON.stringify(state),{mode:0o600});const store=await WorldStore.open(file,{requireConnection:true});
 const host=(await store.claimClient('visit-host','host-session',{id:randomUUID(),claimId:randomUUID()},false,50000)).clientLease,guest=(await store.claimClient('visit-guest','guest-session',{id:randomUUID(),claimId:randomUUID()},false,50000)).clientLease;
 const end={id:'home_file_end_once',type:'WithdrawHomeVisit',payload:{visitId:id,visitVersion:2}},before=store.snapshot();await mkdir(file+'.tmp');await assert.rejects(store.dispatch('visit-host',end,51000,'host-session',{clientLease:host}));assert.deepEqual(store.snapshot(),before);assert.deepEqual((await WorldStore.open(file)).snapshot(),before);
 await rm(file+'.tmp',{recursive:true});const attempts=await Promise.allSettled([store.dispatch('visit-host',end,52000,'host-session',{clientLease:host}),store.dispatch('visit-guest',{id:'home_file_stale_move',type:'MoveInterior',payload:{dx:1,dy:0,leaseVersion:2}},52000,'guest-session',{clientLease:guest}),store.dispatch('visit-host',end,52001,'host-session',{clientLease:host})]);
 assert.equal(attempts[0].status,'fulfilled');assert.equal(attempts[1].status,'rejected');if(attempts[1].status==='rejected')assert.ok(code('STALE_LEASE')(attempts[1].reason));assert.equal(attempts[2].status,'fulfilled');if(attempts[2].status==='fulfilled')assert.equal(attempts[2].value.replayed,true);
 const reopened=await WorldStore.open(file,{requireConnection:true});assert.deepEqual(reopened.snapshot(),store.snapshot());assert.equal(reopened.snapshot().world!.positions['visit-guest'].leaseVersion,3);assert.equal((await reopened.dispatch('visit-host',end,53000,'host-session',{clientLease:host})).replayed,true);reconcile(reopened.snapshot());
});

test('citizen and recovery views expose citizen pseudonyms and reviewed terms while keeping consent proof keys and other account IDs private',()=>{
 const {state}=visiting(),view=citizenView(state,'visit-guest',44000),receipt=view.receipts.find(r=>r.type==='AcceptHomeVisit')!;
 assert.deepEqual(Object.keys(receipt.detail.visit as object).sort(),['createdAt','expiresAt','guestId','homeId','hostId','id','status','termsVersion','version']);assert.equal((receipt.detail.visit as {hostId:string}).hostId,state.citizens['visit-host'].id);assert.ok(!JSON.stringify(view.receipts).includes('visit-host'));assert.ok(!JSON.stringify(recoveryCursor(state,'visit-guest',0).receipts).includes('visit-host'));assert.ok(!JSON.stringify(view.homeVisits).includes('acceptedKey'));assert.ok(!JSON.stringify(view.homeVisits).includes('sourceKey'));
});
