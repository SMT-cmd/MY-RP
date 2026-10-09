import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,DomainError,citizenView} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {homeFor,releaseResidence} from '../src/furnishing.ts';
import {homeRooms} from '../src/home-layout.ts';
import {restoreBackup,exportBackup,reconcile} from '../src/recovery.ts';
import {walkTo} from './helpers.ts';
let sequence=0;const actor='builder',cmd=(type:string,payload:Record<string,unknown>={})=>({id:'rooms_test_'+ ++sequence,type,payload});
const run=(s:State,type:string,payload:Record<string,unknown>={},now=10000)=>execute(s,actor,cmd(type,payload),now);
const code=(value:string)=>(e:unknown)=>e instanceof DomainError&&e.code===value;
const line={axis:'h',x:0,y:3,length:10,doorAt:4,acceptedLabour:26000,acceptedMaterials:4,acceptTerms:true,homeVersion:1};
function setup(){let s=run(initialState(),'CreateCitizen',{name:'Builder',state:'Lagos',adultConfirmed:true},100).state;s=walkTo(s,actor,4,7,1000);s=run(s,'EnterBuilding',{buildingId:'shelter'},5000).state;return run(s,'BuyNPCSupply',{goodsId:'materials',quantity:20,acceptedUnitPrice:2000},6000).state;}
test('room construction consumes actual materials and labour once, preserves doors and survives restoration',()=>{
 let s=setup();const before=s.balances['citizen:'+actor],build=cmd('BuildHomePartition',line),batch=Object.keys(s.commerce!.batches)[0];s=execute(s,actor,build,10000).state;assert.equal(execute(s,actor,build,10001).replayed,true);assert.equal(s.balances['citizen:'+actor],before-26000);assert.equal(s.commerce!.batches[batch].quantity,16);
 const home=homeFor(s,actor);assert.deepEqual(homeRooms(home).map(r=>r.area),[30,50]);assert.equal(home.partitions!.length,10);assert.equal(home.partitions!.filter(p=>p.door).length,1);
 s=run(s,'CustomiseRoom',{roomId:'room_0',name:'Bedroom',floor:'cream',homeVersion:2}).state;s=restoreBackup(exportBackup(s));assert.equal(citizenView(s,actor,11000).world!.home!.rooms[0].name,'Bedroom');
 for(const [i,[dx,dy]] of [[0,-1],[0,-1],[0,-1],[-1,0],[-1,0]].entries())s=run(s,'MoveInterior',{dx,dy},12000+i*300).state;
 assert.throws(()=>run(s,'MoveInterior',{dx:0,dy:-1},14000),code('PATH_BLOCKED'));assert.throws(()=>run(s,'InteractHomeFixture',{fixtureId:'bed'},14000),code('TOO_FAR'));
 for(const [i,[dx,dy]] of [[1,0],[1,0],[0,-1],[-1,0]].entries())s=run(s,'MoveInterior',{dx,dy},14500+i*300).state;s=run(s,'InteractHomeFixture',{fixtureId:'bed'},16000).state;assert.equal(s.citizens[actor].life!.lastRestAt,16000);
 const count=Object.keys(s.furnishing!.items).length;releaseResidence(s,home.id,actor);homeFor(s,actor);assert.equal(Object.keys(s.furnishing!.items).length,count);assert.equal(homeRooms(homeFor(s,actor)).length,2);reconcile(s);
});
test('invalid, sealed, overlapping and stale partition builds cannot spend funds or materials',()=>{
 const s=setup(),before=JSON.stringify(s);
 assert.throws(()=>run(s,'BuildHomePartition',{...line,doorAt:null,acceptedLabour:25000}),code('FURNITURE_PATH'));
 assert.throws(()=>run(s,'BuildHomePartition',{...line,y:2}),code('WALL_FURNITURE'));
 assert.throws(()=>run(s,'BuildHomePartition',{...line,doorAt:8}),code('DOOR_BLOCKED'));
 assert.throws(()=>run(s,'BuildHomePartition',{...line,length:11,acceptedLabour:28500}),code('INVALID_PARTITION'));
 assert.throws(()=>run(s,'BuildHomePartition',{...line,acceptedLabour:1}),code('PARTITION_TERMS'));assert.equal(JSON.stringify(s),before);
 let built=run(s,'BuildHomePartition',line).state;assert.throws(()=>run(built,'BuildHomePartition',line),code('HOME_CHANGED'));assert.throws(()=>run(built,'BuildHomePartition',{...line,homeVersion:2}),code('INVALID_PARTITION'));
 const sofa=Object.values(built.furnishing!.items).find(i=>i.alias==='sofa')!;assert.throws(()=>run(built,'PlaceFurniture',{furnitureId:sofa.id,x:9,y:2,rotation:90,finish:'oak',homeVersion:2}),code('WALL_FURNITURE'));
 built=run(built,'RemoveHomePartition',{partitionIds:['h:4:3'],acceptDiscard:true,homeVersion:2}).state;assert.equal(homeRooms(homeFor(built,actor)).length,1);assert.equal(built.balances['citizen:'+actor],s.balances['citizen:'+actor]-26000);assert.equal(Object.values(built.commerce!.batches)[0].quantity,16);
 const forged=structuredClone(built);homeFor(forged,actor).partitions![0].purchaseKey='forged';assert.throws(()=>reconcile(forged),/construction evidence/);
});
test('structural editing belongs to the owner while tenants can name and finish existing rooms',()=>{
 let s=setup();s=run(s,'ReservePropertyPurchase',{propertyId:'npc-Lagos-home',acceptedTotal:512500,acceptTerms:true}).state;const purchase=Object.values(s.property!.purchases)[0];s=run(s,'CompletePropertyPurchase',{purchaseId:purchase.id}).state;s=run(s,'OfferTenancy',{propertyId:'npc-Lagos-home',rent:1000,deposit:1000}).state;
 const tenant='tenant';s=execute(s,tenant,cmd('CreateCitizen',{name:'Tenant',state:'Lagos',adultConfirmed:true}),10000).state;const rental=Object.values(s.property!.rentals)[0];s=execute(s,tenant,cmd('AcceptTenancy',{rentalId:rental.id,acceptedRent:1000,acceptedDeposit:1000,acceptTerms:true}),11000).state;s=walkTo(s,tenant,27,7,12000);s=execute(s,tenant,cmd('EnterBuilding',{buildingId:'residence:npc-Lagos-home'}),22000).state;
 assert.throws(()=>execute(s,tenant,cmd('BuildHomePartition',line),23000),code('CONSTRUCTION_PERMISSION'));s=execute(s,tenant,cmd('CustomiseRoom',{roomId:'room_0',name:'Living room',floor:'sage',homeVersion:1}),23000).state;assert.equal(homeRooms(homeFor(s,tenant))[0].name,'Living room');reconcile(s);
});
