import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,DomainError,citizenView} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {FURNITURE,homeFor,releaseResidence} from '../src/furnishing.ts';
import {walkTo} from './helpers.ts';
import {reconcile,restoreBackup,exportBackup} from '../src/recovery.ts';
let n=0;const command=(type:string,payload:Record<string,unknown>={})=>({id:'furnishing_test_'+ ++n,type,payload});
const run=(s:State,actor:string,type:string,payload:Record<string,unknown>={},now=10000)=>execute(s,actor,command(type,payload),now);
const code=(c:string)=>(e:unknown)=>e instanceof DomainError&&e.code===c;
function setup(){let s=initialState();for(const actor of ['resident-one','resident-two'])s=run(s,actor,'CreateCitizen',{name:actor,state:'Lagos',adultConfirmed:true},100).state;s=walkTo(s,'resident-one',4,7,1000);return run(s,'resident-one','EnterBuilding',{buildingId:'shelter'},5000).state;}
test('furniture purchase settles once, storage stays private and edited layouts survive backup restoration',()=>{
 let s=setup();const model=FURNITURE.find(x=>x.id==='armchair')!,cmd=command('BuyFurniture',{modelId:model.id,acceptedPrice:model.price,finish:'navy',acceptTerms:true}),before=s.balances['citizen:resident-one'];
 s=execute(s,'resident-one',cmd,10000).state;assert.equal(execute(s,'resident-one',cmd,10001).replayed,true);assert.equal(s.balances['citizen:resident-one'],before-model.price);
 const item=Object.values(s.furnishing!.items).find(i=>!i.starter)!,home=homeFor(s,'resident-one');assert.equal(item.placement,null);
 assert.throws(()=>run(s,'resident-two','PlaceFurniture',{furnitureId:item.id,x:9,y:6,rotation:0,finish:'navy',homeVersion:1}),code('HOME_REQUIRED'));
 s=run(s,'resident-one','PlaceFurniture',{furnitureId:item.id,x:9,y:6,rotation:90,finish:'terracotta',homeVersion:home.version}).state;
 assert.throws(()=>run(s,'resident-one','CustomiseHome',{homeVersion:1,wall:'cream',floor:'oak'}),code('HOME_CHANGED'));
 s=run(s,'resident-one','CustomiseHome',{homeVersion:2,wall:'sage',floor:'walnut'}).state;s=restoreBackup(exportBackup(s));
 assert.equal(s.furnishing!.homes[home.id].wall,'sage');assert.equal(s.furnishing!.items[item.id].finish,'terracotta');
 assert.ok(!citizenView(s,'resident-two',10000).furnishing!.items.some(i=>i.id===item.id));reconcile(s);
});
test('furniture rejects collisions, actor occupancy, sealed paths, incorrect quotes and forged paid inventory',()=>{
 let s=setup();s=run(s,'resident-one','BuyFurniture',{modelId:'armchair',acceptedPrice:25000,finish:'oak',acceptTerms:true}).state;const item=Object.values(s.furnishing!.items).find(i=>!i.starter)!;
 for(const [x,y] of [[1,1],[4,6],[4,7],[-1,5],[10,5]])assert.throws(()=>run(s,'resident-one','PlaceFurniture',{furnitureId:item.id,x,y,rotation:0,finish:'oak',homeVersion:1}),code('FURNITURE_COLLISION'));
 assert.throws(()=>run(s,'resident-one','BuyFurniture',{modelId:'sofa',acceptedPrice:1,finish:'oak',acceptTerms:true}),code('FURNITURE_TERMS'));
 assert.throws(()=>run(s,'resident-one','PlaceFurniture',{furnitureId:item.id,x:0,y:0,rotation:'',finish:'oak',homeVersion:1}),code('FURNITURE_PLACEMENT'));
 const corrupted=structuredClone(s);corrupted.furnishing!.items[item.id].purchaseKey='fake';assert.throws(()=>reconcile(corrupted),/purchase evidence/);
 s=run(s,'resident-one','MoveInterior',{dx:1,dy:0},12000).state;assert.throws(()=>run(s,'resident-one','PlaceFurniture',{furnitureId:item.id,x:5,y:6,rotation:0,finish:'oak',homeVersion:1}),code('FURNITURE_OCCUPIED'));
 const bed=Object.values(s.furnishing!.items).find(i=>i.alias==='bed')!;assert.throws(()=>run(s,'resident-one','StoreFurniture',{furnitureId:bed.id,homeVersion:1}),code('ESSENTIAL_FURNITURE'));
 const chairs=[item.id];for(let i=0;i<3;i++){const buy=run(s,'resident-one','BuyFurniture',{modelId:'armchair',acceptedPrice:25000,finish:'oak',acceptTerms:true});s=buy.state;chairs.push(String(buy.receipt.detail.furnitureId));}
 for(const [i,[x,y]] of [[0,7],[1,7],[0,5]].entries())s=run(s,'resident-one','PlaceFurniture',{furnitureId:chairs[i],x,y,rotation:0,finish:'oak',homeVersion:1+i}).state;
 assert.throws(()=>run(s,'resident-one','PlaceFurniture',{furnitureId:chairs[3],x:1,y:6,rotation:0,finish:'oak',homeVersion:4}),code('FURNITURE_PATH'));
});
test('parking enforces vehicle title, local capacity and retrieval before sale or travel',()=>{
 let s=setup();s=run(s,'resident-one','ExitBuilding',{}).state;const bought=run(s,'resident-one','BuyNPCVehicle',{modelId:'compact',acceptedPrice:300000,acceptTerms:true});s=bought.state;const vehicleId=String(bought.receipt.detail.vehicleId);
 assert.throws(()=>run(s,'resident-two','ParkVehicle',{vehicleId,slot:1}),code('VEHICLE_PERMISSION'));
 s=run(s,'resident-one','ParkVehicle',{vehicleId,slot:1}).state;assert.throws(()=>run(s,'resident-one','OfferVehicleSale',{vehicleId,price:200000}),code('VEHICLE_IN_PARKING'));
 const second=run(s,'resident-one','BuyNPCVehicle',{modelId:'compact',acceptedPrice:300000,acceptTerms:true});s=second.state;assert.throws(()=>run(s,'resident-one','ParkVehicle',{vehicleId:second.receipt.detail.vehicleId,slot:1}),code('PARKING_OCCUPIED'));
 s=restoreBackup(exportBackup(s));s=run(s,'resident-one','UnparkVehicle',{vehicleId}).state;s=run(s,'resident-one','OfferVehicleSale',{vehicleId,price:200000}).state;
 assert.equal(Object.values(s.furnishing!.parking)[0].status,'released');reconcile(s);
});

test('leaving a residence preserves purchased furniture and restores a usable starter room without duplicate grants',()=>{
 let s=setup();s=run(s,'resident-one','BuyFurniture',{modelId:'plant',acceptedPrice:7000,finish:'sage',acceptTerms:true}).state;const home=homeFor(s,'resident-one'),paid=Object.values(s.furnishing!.items).find(i=>!i.starter)!;
 s=run(s,'resident-one','PlaceFurniture',{furnitureId:paid.id,x:9,y:6,rotation:0,finish:'sage',homeVersion:home.version}).state;
 const before=s.balances['citizen:resident-one'],count=Object.keys(s.furnishing!.items).length;releaseResidence(s,home.id,'resident-one');assert.equal(s.world!.positions['resident-one'].interior,null);assert.equal(s.furnishing!.items[paid.id].placement,null);
 homeFor(s,'resident-one');assert.equal(Object.keys(s.furnishing!.items).length,count);assert.equal(s.balances['citizen:resident-one'],before);assert.equal(Object.values(s.furnishing!.items).filter(i=>i.homeId===home.id).length,6);reconcile(s);
});
