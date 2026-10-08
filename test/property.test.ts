import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,DomainError,DAY,citizenView} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {reconcile,exportBackup,restoreBackup} from '../src/recovery.ts';
let seq=0;const start=10*DAY,owner='home-owner',tenant='home-tenant',buyer='home-buyer';
const cmd=(type:string,payload:Record<string,unknown>={})=>({id:'property_test_'+ ++seq,type,payload});
const run=(s:State,actor:string,type:string,payload:Record<string,unknown>={},now=start)=>execute(s,actor,cmd(type,payload),now);
const code=(value:string)=>(e:unknown)=>e instanceof DomainError&&e.code===value;
function setup(){let s=initialState();for(const actor of [owner,tenant,buyer])s=run(s,actor,'CreateCitizen',{name:actor,state:'Lagos',adultConfirmed:true}).state;return s;}
function buy(s:State,actor=owner,kind='home'){const reservation=run(s,actor,'ReservePropertyPurchase',{propertyId:'npc-Lagos-'+kind,acceptedTotal:kind==='home'?512500:307500,acceptTerms:true});const result=run(reservation.state,actor,'CompletePropertyPurchase',{purchaseId:reservation.receipt.detail.purchaseId});return{state:result.state,propertyId:String(result.receipt.detail.propertyId)};}
function rent(s:State,propertyId:string){const offer=run(s,owner,'OfferTenancy',{propertyId,rent:10000,deposit:20000});const accepted=run(offer.state,tenant,'AcceptTenancy',{rentalId:offer.receipt.detail.rentalId,acceptedRent:10000,acceptedDeposit:20000,acceptTerms:true});return{state:accepted.state,tenancyId:String(accepted.receipt.detail.tenancyId)};}
test('property reservation, title and tax settle once and last-unit competition is atomic',()=>{
 let s=setup();const reserve=cmd('ReservePropertyPurchase',{propertyId:'npc-Lagos-home',acceptedTotal:512500,acceptTerms:true});const reserved=execute(s,owner,reserve,start);s=reserved.state;assert.equal(execute(s,owner,reserve,start+1).replayed,true);assert.throws(()=>run(s,buyer,'ReservePropertyPurchase',{propertyId:'npc-Lagos-home',acceptedTotal:512500,acceptTerms:true}),code('PROPERTY_UNAVAILABLE'));
 const settle=cmd('CompletePropertyPurchase',{purchaseId:reserved.receipt.detail.purchaseId});s=execute(s,owner,settle,start+1).state;assert.equal(s.property!.assets['npc-Lagos-home'].owner,owner);assert.equal(s.balances['treasury:state:Lagos'],12500);assert.equal(execute(s,owner,settle,start+2).replayed,true);assert.throws(()=>run(s,buyer,'ListProperty',{propertyId:'npc-Lagos-home',price:1}),code('PROPERTY_PERMISSION'));reconcile(s);
 const back=run(s,buyer,'ReservePropertyPurchase',{propertyId:'npc-Lagos-land',acceptedTotal:307500,acceptTerms:true});const cash=s.balances['citizen:'+buyer];s=run(back.state,buyer,'CompletePropertyPurchase',{purchaseId:back.receipt.detail.purchaseId},start+60000).state;assert.equal(s.balances['citizen:'+buyer],cash);assert.equal(s.property!.assets['npc-Lagos-land'].owner,'npc');reconcile(s);
});
test('tenancy deposits and contracts survive sale without giving landlords personal-wallet powers',()=>{
 let {state:s,propertyId}=buy(setup());let leased=rent(s,propertyId);s=leased.state;const tenancyId=leased.tenancyId,tenantCash=s.balances['citizen:'+tenant];
 assert.throws(()=>run(s,owner,'PayRent',{tenancyId,acceptedAmount:10000},start+7*DAY),code('RENT_REVIEW'));
 const sale=run(s,owner,'ListProperty',{propertyId,price:600000});s=sale.state;const reserved=run(s,buyer,'ReservePropertyPurchase',{saleId:sale.receipt.detail.saleId,acceptedTotal:615000,acceptTerms:true});s=run(reserved.state,buyer,'CompletePropertyPurchase',{purchaseId:reserved.receipt.detail.purchaseId}).state;
 assert.equal(s.property!.tenancies[tenancyId].status,'active');assert.equal(s.balances['deposit:'+tenancyId],20000);assert.equal(s.balances['citizen:'+tenant],tenantCash);assert.equal(s.citizens[tenant].housing,propertyId);
 const paid=run(s,tenant,'PayRent',{tenancyId,acceptedAmount:10000},start+7*DAY);s=paid.state;assert.equal(s.balances['citizen:'+buyer],setup().balances['citizen:'+buyer]-615000+10000);
 s=restoreBackup(exportBackup(s));s=run(s,tenant,'LeaveTenancy',{tenancyId},start+7*DAY).state;assert.equal(s.balances['deposit:'+tenancyId],0);assert.equal(s.balances['citizen:'+tenant],tenantCash+10000);assert.equal(s.citizens[tenant].housing,'Starter accommodation');reconcile(s);
});
test('notice requires factual independent review, appeal protection and shelter fallback with no repeated eviction',()=>{
 let {state:s,propertyId}=buy(setup());const lease=rent(s,propertyId);s=lease.state;const tenancyId=lease.tenancyId;
 assert.throws(()=>run(s,owner,'GiveTenancyNotice',{tenancyId,reason:'arrears'}),code('NO_ARREARS'));
 s=run(s,owner,'GiveTenancyNotice',{tenancyId,reason:'arrears'},start+7*DAY).state;assert.throws(()=>run(s,owner,'EnforceTenancyNotice',{tenancyId},start+15*DAY),code('DUE_PROCESS_REQUIRED'));
 s=run(s,tenant,'ReviewTenancyNotice',{tenancyId},start+7*DAY).state;s=run(s,tenant,'AppealTenancyNotice',{tenancyId},start+13*DAY).state;s=run(s,tenant,'ReviewTenancyNotice',{tenancyId},start+13*DAY).state;
 assert.throws(()=>run(s,owner,'EnforceTenancyNotice',{tenancyId},start+15*DAY),code('DUE_PROCESS_REQUIRED'));assert.throws(()=>run(s,tenant,'AppealTenancyNotice',{tenancyId},start+14*DAY),code('APPEAL_UNAVAILABLE'));
 const ended=cmd('EnforceTenancyNotice',{tenancyId});s=execute(s,owner,ended,start+20*DAY).state;assert.equal(execute(s,owner,ended,start+21*DAY).replayed,true);assert.equal(s.citizens[tenant].housing,'Starter accommodation');assert.equal(s.balances['deposit:'+tenancyId],0);reconcile(s);
 const second=rent(s,propertyId);s=second.state;const secondId=second.tenancyId;s=run(s,owner,'GiveTenancyNotice',{tenancyId:secondId,reason:'arrears'},start+7*DAY).state;s=run(s,tenant,'PayRent',{tenancyId:secondId,acceptedAmount:10000},start+7*DAY).state;s=run(s,tenant,'ReviewTenancyNotice',{tenancyId:secondId},start+7*DAY).state;assert.equal(s.property!.tenancies[secondId].review,'denied');reconcile(s);
});
test('construction and utility usage consume actual stock and disclosed liabilities are bounded offline',()=>{
 let {state:s,propertyId}=buy(setup(),owner,'land');for(const [goodsId,quantity,acceptedUnitPrice] of [['materials',7,2000],['energy',4,200],['water',4,100]] as const)s=run(s,owner,'BuyNPCSupply',{goodsId,quantity,acceptedUnitPrice}).state;
 const before=s.commerce!.batches,build=run(s,owner,'StartConstruction',{propertyId,acceptedLabour:50000});s=build.state;assert.throws(()=>run(s,owner,'FinishConstruction',{buildId:build.receipt.detail.buildId}),code('CONSTRUCTION_PENDING'));s=run(s,owner,'FinishConstruction',{buildId:build.receipt.detail.buildId},start+60000).state;assert.equal(s.property!.assets[propertyId].kind,'home');assert.equal(Object.values(before).find(b=>b.goods==='materials')!.quantity,7);assert.equal(Object.values(s.commerce!.batches).find(b=>b.goods==='materials')!.quantity,2);
 s=run(s,owner,'ConnectUtilities',{propertyId,acceptedFee:5000}).state;s=run(s,owner,'UseHomeUtilities',{propertyId,acceptedBill:800},start+DAY).state;assert.equal(Object.values(s.commerce!.batches).find(b=>b.goods==='water')!.quantity,0);assert.equal(s.property!.assets[propertyId].utilities.bill,800);s=run(s,owner,'PayUtilityBill',{propertyId,acceptedAmount:800},start+DAY).state;
 const cash=s.balances['citizen:'+owner];const view=citizenView(s,owner,start+200*DAY).property!;assert.equal(view.assets[0].taxDue,3600);assert.equal(s.balances['citizen:'+owner],cash);s=run(s,owner,'InspectProperty',{propertyId},start+200*DAY).state;assert.equal(s.property!.assets[propertyId].quality,92);s=run(s,owner,'PayPropertyTax',{propertyId,acceptedAmount:3600},start+200*DAY).state;s=run(s,owner,'RepairProperty',{propertyId,acceptedFee:10000},start+201*DAY).state;assert.equal(s.property!.assets[propertyId].quality,100);reconcile(s);
});
