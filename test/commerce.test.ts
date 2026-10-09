import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,DAY,DomainError,citizenView} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {graduate,completeCourse} from './helpers.ts';
import {GOODS,RECIPES,shippingQuote} from '../src/commerce.ts';
import {reconcile} from '../src/recovery.ts';
let sequence=0;const start=10*DAY,now=start+7*DAY,owner='owner-one';
const run=(s:State,type:string,payload:Record<string,unknown>={},at=now,actor=owner)=>execute(s,actor,{id:'commerce_test_'+ ++sequence,type,payload},at);
const code=(c:string)=>(e:unknown)=>e instanceof DomainError&&e.code===c;
function setup(){let s=run(initialState(),'CreateCitizen',{name:'Owner',state:'Lagos',adultConfirmed:true},start).state;s=graduate(s,owner,start);s=completeCourse(s,owner,'secondary',start+5*DAY);return completeCourse(s,owner,'business',start+6*DAY);}
function company(s:State,sector='manufacturing'){const r=run(s,'RegisterCompany',{name:'Nation Works',sector,capital:100000});return{s:r.state,id:String(r.receipt.detail.companyId)};}
function buy(s:State,id:string,goodsId:string,quantity:number){return run(s,'BuyNPCSupply',{companyId:id,goodsId,quantity,acceptedUnitPrice:GOODS.find(g=>g.id===goodsId)!.price}).state;}
function listing(){let {s,id}=company(setup());s=buy(s,id,'food',1);const batch=Object.values(s.commerce!.batches).find(b=>b.owner==='company:'+id)!;const r=run(s,'ListGoods',{companyId:id,batchId:batch.id,quantity:1,price:10000});s=r.state;s=run(s,'CreateCitizen',{name:'Buyer',state:'Ogun',adultConfirmed:true},now,'buyer-one').state;s=run(s,'CreateCitizen',{name:'Other',state:'Ogun',adultConfirmed:true},now,'buyer-two').state;return{s,id,listingId:r.receipt.detail.listingId};}
test('company roles, money and all production recipes enforce real inputs and finite output',()=>{
 let s=setup();assert.throws(()=>run(s,'RegisterCompany',{name:'Bad',sector:'medicine',capital:100000}),code('INVALID_COMPANY'));
 for(const recipe of RECIPES){let created=company(s,recipe.sector);s=created.s;const id=created.id;assert.throws(()=>run(s,'StartProduction',{companyId:id,recipeId:recipe.id}),code('INPUTS_REQUIRED'));for(const [goods,quantity] of Object.entries(recipe.inputs))s=buy(s,id,goods,quantity!);
  const production=run(s,'StartProduction',{companyId:id,recipeId:recipe.id});s=production.state;const productionId=production.receipt.detail.productionId;
  assert.throws(()=>run(s,'FinishProduction',{companyId:id,productionId},now+59999),code('PRODUCTION_PENDING'));
  const complete={id:'produce_unique_'+ ++sequence,type:'FinishProduction',payload:{companyId:id,productionId}};s=execute(s,owner,complete,now+60000).state;assert.equal(execute(s,owner,complete,now+DAY).replayed,true);
  const output=s.commerce!.batches['output_'+productionId];assert.equal(output.quantity,recipe.quantity);assert.equal(output.goods,recipe.output);assert.ok(output.unitCost>0);
 }
 reconcile(s);assert.ok(citizenView(s,owner,now).commerce.companies.every(c=>Object.values(c.shares).reduce((n:any,a:any)=>n+a.units,0)===100000));
});
test('last-stock race and delivery retries conserve inventory, escrow, tax and reviews',()=>{
 let {s,id,listingId}=listing();const q1=run(s,'QuoteOrder',{listingId,quantity:1},now,'buyer-one');s=q1.state;const q2=run(s,'QuoteOrder',{listingId,quantity:1},now,'buyer-two');s=q2.state;
 const quote=s.commerce!.quotes[String(q1.receipt.detail.quoteId)],fund={id:'fund_stock_unique',type:'FundOrder',payload:{quoteId:quote.id,acceptedTotal:quote.price+quote.shipping,acceptTerms:true}};
 const funded=execute(s,'buyer-one',fund,now+1000);s=funded.state;assert.equal(execute(s,'buyer-one',fund,now+2000).replayed,true);
 const other=s.commerce!.quotes[String(q2.receipt.detail.quoteId)];assert.throws(()=>run(s,'FundOrder',{quoteId:other.id,acceptedTotal:other.price+other.shipping,acceptTerms:true},now+1000,'buyer-two'),code('OUT_OF_STOCK'));
 const orderId=String(funded.receipt.detail.orderId);assert.throws(()=>run(s,'AcceptOrder',{orderId},now+1000,'buyer-one'),code('ACCEPTANCE_REQUIRED'));
 for(let i=1;i<=4;i++)s=run(s,'AdvanceOrder',{orderId},now+1000+i*2000,'buyer-one').state;
 const arrival=s.commerce!.orders[orderId].arriveAt;s=run(s,'AdvanceOrder',{orderId},arrival,'buyer-one').state;
 assert.throws(()=>run(s,'AcceptOrder',{orderId},arrival,owner),code('ACCEPTANCE_REQUIRED'));
 const accept={id:'accept_stock_unique',type:'AcceptOrder',payload:{orderId}};s=execute(s,'buyer-one',accept,arrival).state;assert.equal(execute(s,'buyer-one',accept,arrival+DAY).replayed,true);
 assert.equal(s.balances['escrow:'+orderId],0);assert.equal(s.commerce!.batches['delivered_'+orderId].quantity,1);assert.equal(s.balances['treasury:state:Lagos'],10000+250);
 s=run(s,'ReviewService',{orderId,score:5,text:'Verified delivery'},arrival+1000,'buyer-one').state;s=run(s,'ReviewService',{orderId,score:4,text:'Edited review'},arrival+2000,'buyer-one').state;assert.equal(Object.keys(s.commerce!.reviews).length,1);assert.throws(()=>run(s,'ReviewService',{orderId,score:5},arrival+2000,owner),code('REVIEW_INELIGIBLE'));reconcile(s);
});
test('cancellation returns one payment and reserved stock; company privileges cannot be forged',()=>{
 let {s,id,listingId}=listing();assert.throws(()=>run(s,'BuyNPCSupply',{companyId:id,goodsId:'fuel',quantity:1,acceptedUnitPrice:300,role:'founder'},now,'buyer-one'),code('COMPANY_PERMISSION'));
 const quoted=run(s,'QuoteOrder',{listingId,quantity:1},now,'buyer-one');s=quoted.state;const q=s.commerce!.quotes[String(quoted.receipt.detail.quoteId)],before=s.balances['citizen:buyer-one'];const funded=run(s,'FundOrder',{quoteId:q.id,acceptedTotal:q.price+q.shipping,acceptTerms:true},now,'buyer-one');s=funded.state;s=run(s,'CancelOrder',{orderId:funded.receipt.detail.orderId},now+1,'buyer-one').state;assert.equal(s.balances['citizen:buyer-one'],before);assert.equal(s.commerce!.listings[String(listingId)].remaining,1);reconcile(s);
 const original=shippingQuote(s,'Lagos','Ogun');s.commerce!.fuelPrice=600;s.commerce!.roads['Lagos>Ogun']=30;const shock=shippingQuote(s,'Lagos','Ogun');assert.ok(shock.price>original.price);assert.ok(shock.duration>original.duration);s.commerce!.roads['Lagos>Ogun']=100;assert.ok(shippingQuote(s,'Lagos','Ogun').price<shock.price);
});
test('expired cargo refunds actual escrow without renewing shelf life or duplicating goods',()=>{
 let {s,listingId}=listing();const quoted=run(s,'QuoteOrder',{listingId,quantity:1},now,'buyer-one');s=quoted.state;const q=s.commerce!.quotes[String(quoted.receipt.detail.quoteId)],before=s.balances['citizen:buyer-one'];const funded=run(s,'FundOrder',{quoteId:q.id,acceptedTotal:q.price+q.shipping,acceptTerms:true},now,'buyer-one');s=funded.state;const orderId=String(funded.receipt.detail.orderId);
 s=run(s,'AdvanceOrder',{orderId},now+8*DAY,'buyer-one').state;assert.equal(s.commerce!.orders[orderId].status,'damaged');const refund={id:'spoiled_refund_unique',type:'RefundDamagedOrder',payload:{orderId}};s=execute(s,'buyer-one',refund,now+8*DAY).state;assert.equal(execute(s,'buyer-one',refund,now+9*DAY).replayed,true);assert.equal(s.balances['citizen:buyer-one'],before);assert.equal(s.commerce!.batches['delivered_'+orderId],undefined);reconcile(s);
 const corrupt=structuredClone(s),batch=Object.values(corrupt.commerce!.batches)[0];batch.quantity++;assert.throws(()=>reconcile(corrupt),/Batch reconciliation/);
});
