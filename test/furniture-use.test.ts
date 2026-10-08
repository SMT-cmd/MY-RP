import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execute,initialState,citizenView,DomainError} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {homeFor,homeStep,homeFixtures} from '../src/furnishing.ts';
import {HOME_VISIT_RULES} from '../src/home-visits.ts';
import {FURNITURE_USE_RULES} from '../src/furniture-use.ts';
import {claimClient} from '../src/sessions.ts';
import {nearbyPresence} from '../src/presence.ts';
import {reconcile,exportBackup,restoreBackup} from '../src/recovery.ts';
import {walkTo} from './helpers.ts';
const code=(c:string)=>(e:unknown)=>e instanceof DomainError&&e.code===c;
let sequence=0,clock=10000;
const run=(s:State,actor:string,type:string,payload:Record<string,unknown>={})=>execute(s,actor,{id:'furniture_use_'+ ++sequence,type,payload},clock+=700);
function setup(){
 let s=initialState();for(let i=0;i<4;i++)s=run(s,'use-person-'+i,'CreateCitizen',{name:'Citizen '+i,state:'Lagos',adultConfirmed:true}).state;
 s=walkTo(s,'use-person-0',4,7,clock);clock+=5000;s=run(s,'use-person-0','EnterBuilding',{buildingId:'shelter'}).state;
 for(let i=1;i<4;i++){const actor='use-person-'+i,home=homeFor(s,'use-person-0'),offered=run(s,'use-person-0','InviteHomeVisit',{citizenId:s.citizens[actor].id,homeVersion:home.version,leaseVersion:2,durationMinutes:15,termsVersion:HOME_VISIT_RULES.version,acceptTerms:true});s=offered.state;const v=offered.receipt.detail.visit as {id:string;homeId:string;expiresAt:number};s=run(s,actor,'AcceptHomeVisit',{visitId:v.id,visitVersion:1,homeId:v.homeId,acceptedExpiresAt:v.expiresAt,termsVersion:HOME_VISIT_RULES.version,acceptTerms:true}).state;s=walkTo(s,actor,4,7,clock);clock+=5000;s=run(s,actor,'EnterBuilding',{buildingId:'visit:'+v.id}).state;}
 return s;
}
function walk(s:State,actor:string,x:number,y:number){
 const p=s.world!.positions[actor],home=s.furnishing!.homes[p.homeId!],queue:[number,number,[number,number][]][]=[[p.interiorX!,p.interiorY!,[]]],seen=new Set<string>();let path:[number,number][]|undefined;
 while(queue.length){const [cx,cy,steps]=queue.shift()!;if(cx===x&&cy===y){path=steps;break;}if(seen.has(cx+':'+cy))continue;seen.add(cx+':'+cy);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(homeStep(s,home,cx,cy,cx+dx,cy+dy))queue.push([cx+dx,cy+dy,[...steps,[dx,dy]]]);}
 assert.ok(path);for(const [dx,dy] of path)s=run(s,actor,'MoveInterior',{dx,dy}).state;return s;
}
test('three occupants claim distinct sofa seats, a fourth is refused, and retries/renewal preserve the assigned seat without rewards',()=>{
 let s=setup();for(let i=0;i<4;i++)s=walk(s,'use-person-'+i,6,5);const wallet={...s.balances},journals=s.journals.length;
 for(let i=0;i<3;i++){s=run(s,'use-person-'+i,'InteractHomeFixture',{fixtureId:'sofa'}).state;assert.equal(s.world!.positions['use-person-'+i].activity!.slot,i);}
 const before=structuredClone(s);assert.throws(()=>run(s,'use-person-3','InteractHomeFixture',{fixtureId:'sofa'}),code('FIXTURE_BUSY'));assert.deepEqual(s,before);
 assert.throws(()=>run(s,'use-person-0','InteractHomeFixture',{fixtureId:'sofa',useSlot:2}),code('FIXTURE_BUSY'));
 const command={id:'furniture_use_renew_once',type:'InteractHomeFixture',payload:{fixtureId:'sofa'}},renewed=execute(s,'use-person-0',command,clock+=700);assert.equal(renewed.receipt.detail.fixtureUseSlot,0);s=renewed.state;assert.equal(execute(s,'use-person-0',command,clock+1000).replayed,true);assert.equal(s.world!.positions['use-person-0'].activity!.startedAt,clock);
 const sofa=citizenView(s,'use-person-3',clock).world!.home!.fixtures.find(f=>f.id==='sofa')!;assert.equal(sofa.use.capacity,3);assert.equal(sofa.use.free,0);assert.deepEqual(sofa.use.availableSlots,[]);assert.deepEqual(s.balances,wallet);assert.equal(s.journals.length,journals);assert.deepEqual(restoreBackup(exportBackup(s)),s);
 s=run(s,'use-person-1','MoveInterior',{dx:1,dy:0}).state;s=run(s,'use-person-3','InteractHomeFixture',{fixtureId:'sofa'}).state;assert.equal(s.world!.positions['use-person-3'].activity!.slot,1);reconcile(s);
});
test('a single-use fixture releases by time and leaving; the available revision changes without publishing hidden identities or advancing business cursor',()=>{
 let s=setup();for(const actor of ['use-person-0','use-person-1'])s=walk(s,actor,7,3);
 s=run(s,'use-person-0','InteractHomeFixture',{fixtureId:'sink'}).state;const started=s.world!.positions['use-person-0'].activity!.startedAt;
 assert.throws(()=>run(s,'use-person-1','InteractHomeFixture',{fixtureId:'sink'}),code('FIXTURE_BUSY'));
 const client=claimClient(s,'use-person-1','use-session',{id:randomUUID(),claimId:randomUUID()},false,clock).clientLease,frame=nearbyPresence(s,'use-person-1','use-session',client,clock);assert.deepEqual(frame.people,[]);assert.ok(frame.homeUseRevision);const before=structuredClone(s),later=started+FURNITURE_USE_RULES.duration;
 const released=nearbyPresence(s,'use-person-1','use-session',client,later);assert.notEqual(released.homeUseRevision,frame.homeUseRevision);assert.equal(released.cursor,frame.cursor);assert.ok(!JSON.stringify(released).includes('use-person-0'));assert.deepEqual(s,before);
 const fixture=citizenView(s,'use-person-1',later).world!.home!.fixtures.find(f=>f.id==='sink')!;assert.equal(fixture.use.free,1);assert.equal(fixture.use.nextAvailableAt,null);
 clock=later;s=run(s,'use-person-1','InteractHomeFixture',{fixtureId:'sink'}).state;assert.equal(s.world!.positions['use-person-0'].activity,undefined);assert.equal(s.world!.positions['use-person-1'].activity!.slot,0);
 s=run(s,'use-person-1','ExitBuilding').state;assert.equal(s.world!.positions['use-person-1'].activity,undefined);reconcile(s);
});
test('layout changes clear every affected use and recovery rejects forged fixture positions, duplicate claims or unsupported evidence',()=>{
 let s=setup();s=walk(s,'use-person-0',6,5);s=walk(s,'use-person-1',6,5);s=run(s,'use-person-0','InteractHomeFixture',{fixtureId:'sofa',useSlot:2}).state;s=run(s,'use-person-1','InteractHomeFixture',{fixtureId:'sofa',useSlot:0}).state;
 assert.throws(()=>run(s,'use-person-0','InteractHomeFixture',{fixtureId:'sofa',useSlot:3}),code('INVALID_USE_SLOT'));
 for(const alter of [(x:State)=>x.world!.positions['use-person-0'].activity!.slot=0,(x:State)=>x.world!.positions['use-person-0'].activity!.useKey='use-person-1:unknown',(x:State)=>x.world!.positions['use-person-0'].activity!.instanceId='not-a-fixture']){const forged=structuredClone(s);alter(forged);assert.throws(()=>reconcile(forged),/Furniture use/);}
 const home=homeFor(s,'use-person-0'),item=homeFixtures(s,home).find(f=>f.id==='sofa')!;s=run(s,'use-person-0','StoreFurniture',{furnitureId:item.instanceId,homeVersion:home.version}).state;assert.equal(s.world!.positions['use-person-0'].activity,undefined);assert.equal(s.world!.positions['use-person-1'].activity,undefined);reconcile(s);
});
test('opted-in shared activity projects only the physical seat and keeps command evidence private',()=>{
 let s=setup();s=walk(s,'use-person-0',6,5);s=run(s,'use-person-0','SetPrivacy',{presence:true,location:true}).state;s=run(s,'use-person-0','InteractHomeFixture',{fixtureId:'sofa',useSlot:2}).state;
 claimClient(s,'use-person-0','host-use-session',{id:randomUUID(),claimId:randomUUID()},false,clock);const fence=claimClient(s,'use-person-1','guest-use-session',{id:randomUUID(),claimId:randomUUID()},false,clock).clientLease,frame=nearbyPresence(s,'use-person-1','guest-use-session',fence,clock);
 assert.equal(frame.people.length,1);assert.equal(frame.people[0].activity!.slot,2);assert.deepEqual(Object.keys(frame.people[0].activity!).sort(),['fixtureId','kind','slot','startedAt']);assert.ok(!JSON.stringify(frame.people).includes('useKey'));assert.ok(!JSON.stringify(frame.people).includes('use-person-0'));
});
