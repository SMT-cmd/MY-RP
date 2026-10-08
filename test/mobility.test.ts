import test from 'node:test';
import {createHash} from 'node:crypto';
import {incidentRoll} from '../src/incidents.ts';
import assert from 'node:assert/strict';
import {initialState,execute,DomainError,DAY,citizenView} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {graduate,completeCourse} from './helpers.ts';
import {vehicleQuote} from '../src/mobility.ts';
import {exportBackup,restoreBackup,reconcile} from '../src/recovery.ts';
let seq=0;const start=10*DAY,now=start+7*DAY,owner='vehicle-owner',driver='vehicle-driver',buyer='vehicle-buyer';
const cmd=(type:string,payload:Record<string,unknown>={})=>({id:'mobility_test_'+ ++seq,type,payload});
const run=(s:State,a:string,type:string,payload:Record<string,unknown>={},at=now)=>execute(s,a,cmd(type,payload),at);
const code=(value:string)=>(e:unknown)=>e instanceof DomainError&&e.code===value;
function setup(){let s=initialState();for(const actor of [owner,driver,buyer])s=run(s,actor,'CreateCitizen',{name:actor,state:'Lagos',adultConfirmed:true},start).state;for(const actor of [owner,driver]){s=graduate(s,actor,start);s=completeCourse(s,actor,'driving',start+5*DAY);}const buy=run(s,owner,'BuyNPCVehicle',{modelId:'compact',acceptedPrice:300000,acceptTerms:true});s=buy.state;const vehicleId=String(buy.receipt.detail.vehicleId);s=run(s,owner,'BuyNPCSupply',{goodsId:'fuel',quantity:50,acceptedUnitPrice:300}).state;s=run(s,owner,'RefuelVehicle',{vehicleId,litres:50}).state;return{state:s,vehicleId};}
test('vehicles require current licences, consensual driving permissions and real stored fuel',()=>{
 let {state:s,vehicleId}=setup();const quote=vehicleQuote(s,s.mobility!.vehicles[vehicleId],'Ogun');assert.throws(()=>run(s,buyer,'BeginVehicleTravel',{vehicleId,destination:'Ogun',acceptedFuel:quote.fuel,acceptedToll:quote.toll,acceptTerms:true}),code('VEHICLE_PERMISSION'));
 const invitation=run(s,owner,'InviteVehicleDriver',{vehicleId,citizenId:s.citizens[driver].id});s=invitation.state;assert.throws(()=>run(s,driver,'AcceptVehicleDriver',{invitationId:invitation.receipt.detail.invitationId}),code('DRIVER_ELIGIBILITY'));s=run(s,driver,'AcceptVehicleDriver',{invitationId:invitation.receipt.detail.invitationId,consent:true}).state;
 assert.throws(()=>run(s,driver,'OfferVehicleSale',{vehicleId,price:1}),code('VEHICLE_PERMISSION'));assert.throws(()=>run(s,owner,'RefuelVehicle',{vehicleId,litres:1}),code('INVALID_AMOUNT'));assert.equal(s.mobility!.vehicles[vehicleId].fuel,50);assert.equal(s.commerce!.stock!.balances['fuel:vehicle:'+vehicleId],50);reconcile(s);
});
test('journeys lock one actor lease and vehicle, cancellation returns fuel and arrival burns it once after recovery',()=>{
 let {state:s,vehicleId}=setup();const initialLease=s.world!.positions[owner].leaseVersion,quote=vehicleQuote(s,s.mobility!.vehicles[vehicleId],'Ogun'),begin=cmd('BeginVehicleTravel',{vehicleId,destination:'Ogun',acceptedFuel:quote.fuel,acceptedToll:quote.toll,acceptTerms:true});let result=execute(s,owner,begin,now);s=result.state;assert.equal(execute(s,owner,begin,now+1).replayed,true);assert.throws(()=>run(s,owner,'MoveCitizen',{dx:1,dy:0},now+500),code('IN_TRANSIT'));assert.throws(()=>run(s,owner,'OfferVehicleSale',{vehicleId,price:500000}),code('VEHICLE_BUSY'));
 s=run(s,owner,'CancelTravel',{},now+1000).state;assert.equal(s.mobility!.vehicles[vehicleId].fuel,50);assert.equal(s.mobility!.vehicles[vehicleId].region,'Lagos');
 result=run(s,owner,'BeginVehicleTravel',begin.payload,now+2000);s=restoreBackup(exportBackup(result.state));const trip=s.world!.trips[s.world!.activeTrips[owner]],arrive=cmd('ArriveTravel');s=execute(s,owner,arrive,trip.arriveAt).state;assert.equal(execute(s,owner,arrive,trip.arriveAt+1000).replayed,true);assert.equal(s.mobility!.vehicles[vehicleId].region,'Ogun');assert.equal(s.world!.positions[owner].region,'Ogun');assert.equal(s.mobility!.vehicles[vehicleId].fuel,50-quote.fuel);assert.equal(s.mobility!.vehicles[vehicleId].condition,100-quote.wear);assert.equal(s.world!.positions[owner].leaseVersion,initialLease+1);reconcile(s);
});
test('vehicle title sales preserve physical tank stock and clear old driver permissions',()=>{
 let {state:s,vehicleId}=setup();const offer=run(s,owner,'OfferVehicleSale',{vehicleId,price:500000});s=offer.state;const saleId=String(offer.receipt.detail.saleId);s=run(s,buyer,'ReserveVehicleSale',{saleId,acceptedPrice:500000,acceptTerms:true}).state;assert.throws(()=>run(s,owner,'CancelVehicleSale',{saleId},now+100),code('SALE_RESERVED'));const complete=cmd('CompleteVehicleSale',{saleId});s=execute(s,buyer,complete,now+500).state;assert.equal(execute(s,buyer,complete,now+600).replayed,true);assert.equal(s.mobility!.vehicles[vehicleId].owner,buyer);assert.deepEqual(s.mobility!.vehicles[vehicleId].permitted,[buyer]);assert.equal(s.mobility!.vehicles[vehicleId].fuel,50);assert.throws(()=>run(s,owner,'RefuelVehicle',{vehicleId,litres:1}),code('VEHICLE_PERMISSION'));assert.equal(citizenView(s,owner,now).mobility!.vehicles.length,0);reconcile(s);
});
test('repair commits material, reserves labour and cannot be paid or restored before verified completion',()=>{
 let {state:s,vehicleId}=setup();s=run(s,owner,'BuyNPCSupply',{goodsId:'materials',quantity:1,acceptedUnitPrice:2000}).state;const requested=run(s,owner,'RequestVehicleRepair',{vehicleId,acceptedFee:1000});s=requested.state;const repairId=requested.receipt.detail.repairId;assert.throws(()=>run(s,owner,'CompleteVehicleRepair',{repairId}),code('REPAIR_PENDING'));assert.throws(()=>run(s,owner,'BeginVehicleTravel',{vehicleId}),code('VEHICLE_BUSY'));const finish=cmd('CompleteVehicleRepair',{repairId});s=execute(s,owner,finish,now+60000).state;assert.equal(execute(s,owner,finish,now+61000).replayed,true);assert.equal(s.balances['repair:'+repairId],0);assert.equal(Object.values(s.commerce!.batches).find(b=>b.goods==='materials')!.quantity,0);reconcile(s);
 const disposal=cmd('DisposeVehicleFuel',{vehicleId});s=execute(s,owner,disposal,now+181*DAY).state;assert.equal(s.mobility!.vehicles[vehicleId].fuel,0);assert.equal(s.commerce!.stock!.balances['fuel:vehicle:'+vehicleId],0);reconcile(s);
});
test('real accumulated driving wear creates bounded recorded breakdown exposure and respects per-asset cooldown',()=>{
 let {state:s,vehicleId}=setup(),at=now;
 const drive=(incident:boolean)=>{const v=s.mobility!.vehicles[vehicleId],destination=v.region==='Lagos'?'Ogun':'Lagos',quote=vehicleQuote(s,v,destination);
  if(v.fuel<quote.fuel){s=run(s,owner,'BuyNPCSupply',{goodsId:'fuel',quantity:50,acceptedUnitPrice:300},at).state;s=run(s,owner,'RefuelVehicle',{vehicleId,litres:50-v.fuel},at).state;}
  const begin=cmd('BeginVehicleTravel',{vehicleId,destination,acceptedFuel:quote.fuel,acceptedToll:quote.toll,acceptTerms:true}),source='vehicle-trip_'+createHash('sha256').update(owner+':'+begin.id).digest('hex').slice(0,24);
  // Deterministic private PRNG boundaries; the actual wear, fuel and journey commands are unchanged.
  for(let n=0;n<10000;n++){s.life!.seed='isolated-vehicle-secret-'+n;const roll=incidentRoll(s,source);if(incident?roll===0:roll>=20)break;}
  s=execute(s,owner,begin,at).state;const trip=s.world!.trips[s.world!.activeTrips[owner]];at=trip.arriveAt;s=run(s,owner,'ArriveTravel',{},at).state;at++;};
 while(s.mobility!.vehicles[vehicleId].condition>=65)drive(false);assert.equal(Object.keys(s.incidents?.records??{}).length,0);drive(true);assert.equal(s.citizens[owner].life!.needs.health,80);const first=Object.values(s.incidents!.records)[0];assert.equal(first.kind,'vehicle-breakdown');assert.equal(first.loss,10000);assert.equal(first.asset,vehicleId);drive(true);assert.equal(Object.keys(s.incidents!.records).length,1);assert.equal(s.citizens[owner].life!.needs.health,80);reconcile(s);
});
