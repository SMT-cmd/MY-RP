import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,citizenView,DomainError} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {homeFor,residenceEntrance} from '../src/furnishing.ts';
import {RESIDENTIAL_PLOTS,streetWalkable} from '../src/neighbourhood.ts';
import {walkTo} from './helpers.ts';
import {exportBackup,restoreBackup,reconcile} from '../src/recovery.ts';
// @ts-expect-error Browser geometry is independent from the command engine.
import {sceneGeometry} from '../web/scene/engine.js';
// @ts-expect-error Browser geometry has no TypeScript declarations.
import {disposeModels} from '../web/scene/models.js';
let sequence=0;
const run=(s:State,actor:string,type:string,payload:Record<string,unknown>={},now=10000)=>execute(s,actor,{id:'residence_test_'+ ++sequence,type,payload},now);
const code=(c:string)=>(e:unknown)=>e instanceof DomainError&&e.code===c;
function setup(){let s=initialState();for(const actor of ['home-person','guest-person','tenant-person'])s=run(s,actor,'CreateCitizen',{name:actor,state:'Lagos',adultConfirmed:true},100).state;return s;}
function buy(s:State,kind='home'){const r=run(s,'home-person','ReservePropertyPurchase',{propertyId:'npc-Lagos-'+kind,acceptedTotal:kind==='home'?512500:307500,acceptTerms:true});return run(r.state,'home-person','CompletePropertyPurchase',{purchaseId:r.receipt.detail.purchaseId}).state;}
test('private homes use stable reachable doors, reject foreign entry and preserve the exit and retry lease',()=>{
 let s=buy(setup()),entrance=residenceEntrance(s,'home-person');assert.deepEqual(entrance.door,{x:27,y:6});assert.ok(streetWalkable(entrance.door.x,entrance.door.y));
 assert.throws(()=>run(s,'home-person','EnterBuilding',{buildingId:'shelter'}),code('INVALID_BUILDING'));
 assert.throws(()=>run(s,'home-person','EnterBuilding',{buildingId:entrance.id}),code('TOO_FAR'));
 s=walkTo(s,'home-person',27,7,11000);s=walkTo(s,'guest-person',27,7,11000);
 assert.throws(()=>run(s,'guest-person','EnterBuilding',{buildingId:entrance.id},30000),code('INVALID_BUILDING'));
 const cmd={id:'residence_entry_once',type:'EnterBuilding',payload:{buildingId:entrance.id,leaseVersion:1}};
 s=execute(s,'home-person',cmd,30000).state;assert.equal(execute(s,'home-person',cmd,31000).replayed,true);assert.equal(s.world!.positions['home-person'].leaseVersion,2);assert.equal(citizenView(s,'home-person',31000).world!.home!.id,'npc-Lagos-home');
 s=restoreBackup(exportBackup(s));s=run(s,'home-person','ExitBuilding',{leaseVersion:2},32000).state;assert.deepEqual([s.world!.positions['home-person'].x,s.world!.positions['home-person'].y],[27,7]);
 const view=citizenView(s,'home-person',33000).world!,geometry=sceneGeometry(view),ids=new Set<string>();geometry.root.traverse((o:{userData:{buildingId?:string}})=>{if(o.userData.buildingId)ids.add(o.userData.buildingId);});assert.ok(ids.has(entrance.id));disposeModels(geometry.root);
 const other=citizenView(s,'guest-person',33000).world!;assert.equal(other.residence.id,'shelter');assert.ok(!other.nearby.some(b=>b.id===entrance.id));
 const forged=structuredClone(s);forged.world!.positions['guest-person'].interior='shelter';forged.world!.positions['guest-person'].homeId=entrance.homeId;assert.throws(()=>reconcile(forged),/residence permission/);
});
test('tenants keep their actual door through title transfer and recover to personal shelter when they leave',()=>{
 let s=buy(setup());const rental=run(s,'home-person','OfferTenancy',{propertyId:'npc-Lagos-home',rent:10000,deposit:20000});s=run(rental.state,'tenant-person','AcceptTenancy',{rentalId:rental.receipt.detail.rentalId,acceptedRent:10000,acceptedDeposit:20000,acceptTerms:true}).state;
 const entrance=residenceEntrance(s,'tenant-person');assert.equal(entrance.name,'Your rented home');assert.equal(residenceEntrance(s,'home-person').id,'shelter');s=walkTo(s,'tenant-person',27,7,11000);s=run(s,'tenant-person','EnterBuilding',{buildingId:entrance.id},30000).state;
 const sale=run(s,'home-person','ListProperty',{propertyId:'npc-Lagos-home',price:500000},31000),reservation=run(sale.state,'guest-person','ReservePropertyPurchase',{saleId:sale.receipt.detail.saleId,acceptedTotal:512500,acceptTerms:true},32000);s=run(reservation.state,'guest-person','CompletePropertyPurchase',{purchaseId:reservation.receipt.detail.purchaseId},33000).state;
 assert.equal(citizenView(s,'tenant-person',34000).world!.home!.id,'npc-Lagos-home');assert.deepEqual(residenceEntrance(s,'tenant-person').door,entrance.door);assert.equal(residenceEntrance(s,'guest-person').id,'shelter');
 const tenancy=Object.values(s.property!.tenancies)[0];s=run(s,'tenant-person','LeaveTenancy',{tenancyId:tenancy.id},35000).state;assert.equal(s.world!.positions['tenant-person'].interior,null);assert.equal(s.world!.positions['tenant-person'].leaseVersion,3);assert.equal(residenceEntrance(s,'tenant-person').id,'shelter');reconcile(s);
});
test('changing from starter housing stores paid furnishings, releases parking and requires the new parking entrance',()=>{
 let s=setup();s=walkTo(s,'home-person',4,7,1000);s=run(s,'home-person','EnterBuilding',{buildingId:'shelter'},5000).state;
 const furniture=run(s,'home-person','BuyFurniture',{modelId:'plant',finish:'sage',acceptedPrice:7000,acceptTerms:true},6000);s=run(furniture.state,'home-person','PlaceFurniture',{furnitureId:furniture.receipt.detail.furnitureId,x:9,y:6,rotation:0,finish:'sage',homeVersion:1},7000).state;
 const old=homeFor(s,'home-person').id;s=buy(s);assert.equal(s.world!.positions['home-person'].interior,null);assert.equal(s.furnishing!.items[String(furniture.receipt.detail.furnitureId)].placement,null);assert.ok(!Object.values(s.furnishing!.items).some(i=>i.homeId===old));
 const car=run(s,'home-person','BuyNPCVehicle',{modelId:'compact',acceptedPrice:300000,acceptTerms:true},11000);s=car.state;const vehicleId=car.receipt.detail.vehicleId;
 assert.throws(()=>run(s,'home-person','ParkVehicle',{vehicleId,slot:1},12000),code('PARKING_DISTANCE'));s=walkTo(s,'home-person',27,7,13000);s=run(s,'home-person','ParkVehicle',{vehicleId,slot:2},30000).state;
 const view=citizenView(s,'home-person',31000).world!;assert.equal(view.parking.vehicles.length,1);assert.deepEqual(view.parking.origin,{x:30,y:5});s=restoreBackup(exportBackup(s));assert.equal(Object.values(s.furnishing!.parking)[0].slot,2);reconcile(s);
});
test('constructed land keeps its separate stable plot and every plot has a reachable front door',()=>{
 let s=buy(setup(),'land');for(const [goodsId,quantity,acceptedUnitPrice] of [['materials',5,2000],['energy',2,200]] as const)s=run(s,'home-person','BuyNPCSupply',{goodsId,quantity,acceptedUnitPrice},11000).state;
 const build=run(s,'home-person','StartConstruction',{propertyId:'npc-Lagos-land',acceptedLabour:50000},12000);s=run(build.state,'home-person','FinishConstruction',{buildId:build.receipt.detail.buildId},73000).state;
 s=run(s,'home-person','SetResidence',{propertyId:'npc-Lagos-land',propertyVersion:s.property!.assets['npc-Lagos-land'].version,acceptTerms:true},74000).state;
 assert.deepEqual(residenceEntrance(s,'home-person').door,{x:36,y:6});assert.notEqual(residenceEntrance(s,'home-person').facadeId,RESIDENTIAL_PLOTS[0].facadeId);for(const plot of RESIDENTIAL_PLOTS)assert.ok(streetWalkable(plot.door.x,plot.door.y));reconcile(s);
});
test('residence selection requires current local permission and terms, preserves obligations and never transfers title',()=>{
 let s=buy(setup()),asset=s.property!.assets['npc-Lagos-home'];
 assert.throws(()=>run(s,'guest-person','SetResidence',{propertyId:asset.id,propertyVersion:asset.version,acceptTerms:true}),code('RESIDENCE_PERMISSION'));
 assert.throws(()=>run(s,'home-person','SetResidence',{propertyId:null}),code('RESIDENCE_TERMS'));
 const cash=s.balances['citizen:home-person'];s=run(s,'home-person','SetResidence',{propertyId:null,acceptTerms:true}).state;
 assert.equal(s.property!.assets[asset.id].owner,'home-person');assert.equal(s.balances['citizen:home-person'],cash);assert.equal(residenceEntrance(s,'home-person').id,'shelter');
 assert.throws(()=>run(s,'home-person','SetResidence',{propertyId:asset.id,propertyVersion:0,acceptTerms:true}),code('PROPERTY_CHANGED'));
 s=run(s,'home-person','SetResidence',{propertyId:asset.id,propertyVersion:asset.version,acceptTerms:true}).state;
 s=walkTo(s,'home-person',27,7,11000);s=run(s,'home-person','EnterBuilding',{buildingId:'residence:'+asset.id},30000).state;
 assert.throws(()=>run(s,'home-person','SetResidence',{propertyId:null,acceptTerms:true},31000),code('RESIDENCE_LOCATION'));
 s=run(s,'home-person','ExitBuilding',{},32000).state;const offer=run(s,'home-person','OfferTenancy',{propertyId:asset.id,rent:10000,deposit:10000},33000);s=run(offer.state,'tenant-person','AcceptTenancy',{rentalId:offer.receipt.detail.rentalId,acceptedRent:10000,acceptedDeposit:10000,acceptTerms:true},34000).state;
 asset=s.property!.assets[asset.id];assert.throws(()=>run(s,'home-person','SetResidence',{propertyId:asset.id,propertyVersion:asset.version,acceptTerms:true},35000),code('RESIDENCE_PERMISSION'));
 s=run(s,'tenant-person','SetResidence',{propertyId:null,acceptTerms:true},35000).state;assert.equal(Object.values(s.property!.tenancies)[0].status,'active');assert.equal(s.balances['deposit:'+Object.values(s.property!.tenancies)[0].id],10000);
 s=run(s,'tenant-person','SetResidence',{propertyId:asset.id,propertyVersion:asset.version,acceptTerms:true},36000).state;assert.equal(s.citizens['tenant-person'].housing,asset.id);reconcile(s);
});
