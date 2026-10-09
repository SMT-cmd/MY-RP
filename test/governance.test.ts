import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,DAY,DomainError,citizenView} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {graduate,completeCourse} from './helpers.ts';
import {availableShares} from '../src/governance.ts';
import {reconcile,exportBackup,restoreBackup} from '../src/recovery.ts';
let sequence=0;const start=10*DAY,now=start+7*DAY,owner='corporate-owner',other='corporate-controller',buyer='share-buyer';
const run=(s:State,type:string,payload:Record<string,unknown>={},actor=owner,at=now)=>execute(s,actor,{id:'governance_test_'+ ++sequence,type,payload},at);
const code=(c:string)=>(e:unknown)=>e instanceof DomainError&&e.code===c;
export function corporateSetup(){
 let s=run(initialState(),'CreateCitizen',{name:'Owner',state:'Lagos',adultConfirmed:true},owner,start).state;
 s=graduate(s,owner,start);s=completeCourse(s,owner,'secondary',start+5*DAY);s=completeCourse(s,owner,'business',start+6*DAY);
 for(const actor of [other,buyer,'outsider-one'])s=run(s,'CreateCitizen',{name:'Citizen',state:'Lagos',adultConfirmed:true},actor).state;
 const registered=run(s,'RegisterCompany',{name:'Shared Works',sector:'manufacturing',capital:500000});s=registered.state;const id=String(registered.receipt.detail.companyId);
 const invite=run(s,'InviteCompanyRole',{companyId:id,citizenId:s.citizens[other].id,role:'cofounder'});s=invite.state;s=run(s,'AcceptCompanyRole',{invitationId:invite.receipt.detail.invitationId,consent:true},other).state;
 return{s,id};
}
function proposal(s:State,id:string,kind:string,rest:Record<string,unknown>={},actor=owner){const r=run(s,'ProposeCorporateAction',{companyId:id,kind,amount:10001,acceptTerms:true,...rest},actor);return{s:r.state,pid:String(r.receipt.detail.proposalId)};}
function vote(s:State,id:string,actor=other,approve=true){return run(s,'VoteCorporateAction',{proposalId:id,approve,signature:s.governance!.actions[id].signature},actor).state;}
function consent(s:State,id:string,actor=buyer){const a=s.governance!.actions[id];return run(s,'AcceptCorporateTerms',{proposalId:id,acceptedAmount:a.amount,acceptedUnits:a.units,signature:a.signature,acceptTerms:true},actor).state;}
function settle(s:State,id:string,actor=owner){return run(s,'ExecuteCorporateAction',{proposalId:id},actor).state;}
test('protected dividend reserves existing funds and requires distinct controller signatures',()=>{
 let {s,id}=corporateSetup();const initial=s.balances['company:'+id];let p=proposal(s,id,'dividend');s=p.s;
 assert.equal(s.balances['company:'+id],initial-10001);assert.equal(s.balances['corporate:'+p.pid],10001);
 assert.throws(()=>settle(s,p.pid),code('CORPORATE_APPROVAL_REQUIRED'));
 s=vote(s,p.pid,owner);assert.equal(s.governance!.actions[p.pid].status,'pending');
 assert.throws(()=>vote(s,p.pid,buyer),code('CORPORATE_PERMISSION'));
 assert.throws(()=>run(s,'VoteCorporateAction',{proposalId:p.pid,approve:true,signature:'forged'},other),code('TERMS_CHANGED'));
 assert.throws(()=>run(s,'PayDividend',{companyId:id,amount:1,acceptTerms:true}),code('MULTI_APPROVAL_REQUIRED'));
 s=vote(s,p.pid);const before=s.balances['citizen:'+owner],cmd={id:'corporate_dividend_once',type:'ExecuteCorporateAction',payload:{proposalId:p.pid}};
 s=execute(s,owner,cmd,now).state;assert.equal(execute(s,owner,cmd,now+DAY).replayed,true);assert.equal(s.balances['citizen:'+owner],before+10001);assert.equal(s.balances['corporate:'+p.pid],0);
 assert.throws(()=>settle(s,p.pid),code('CORPORATE_ACTION_CLOSED'));reconcile(s);reconcile(restoreBackup(exportBackup(s)));
});
test('share sales reserve stock and buyer funds, preserve roles, and refund on cancellation',()=>{
 let {s,id}=corporateSetup();let p=proposal(s,id,'transfer',{units:60000,buyerCitizenId:s.citizens[buyer].id,amount:40000});s=p.s;
 assert.equal(availableShares(s,s.commerce!.companies[id],owner),40000);
 assert.throws(()=>proposal(s,id,'transfer',{units:40001,buyerCitizenId:s.citizens[buyer].id}),code('SHARES_UNAVAILABLE'));
 assert.throws(()=>consent(s,p.pid,'outsider-one'),code('CORPORATE_PERMISSION'));
 const before=s.balances['citizen:'+buyer];s=consent(s,p.pid);assert.equal(s.balances['share-purchase:'+p.pid],40000);
 s=consent(s,p.pid);assert.equal(s.balances['citizen:'+buyer],before-40000);
 s=vote(s,p.pid);s=settle(s,p.pid);assert.equal(s.commerce!.companies[id].shares[buyer],60000);assert.equal(s.commerce!.companies[id].members[buyer],undefined);
 assert.equal(s.commerce!.companies[id].shares[owner],40000);assert.equal(s.balances['share-purchase:'+p.pid],0);reconcile(s);
 p=proposal(s,id,'transfer',{units:10000,buyerCitizenId:s.citizens[other].id,amount:2000},buyer);s=p.s;s=consent(s,p.pid,other);s=run(s,'CancelCorporateAction',{proposalId:p.pid},other).state;
 assert.equal(s.balances['share-purchase:'+p.pid],0);assert.equal(availableShares(s,s.commerce!.companies[id],buyer),60000);reconcile(s);
});
test('new share issuance needs every affected owner consent and buyback burns only consented shares',()=>{
 let {s,id}=corporateSetup();let p=proposal(s,id,'transfer',{units:25000,buyerCitizenId:s.citizens[buyer].id,amount:0});s=settle(vote(consent(p.s,p.pid),p.pid),p.pid);
 p=proposal(s,id,'issue',{units:10000,buyerCitizenId:s.citizens[other].id,amount:20000});s=p.s;s=vote(s,p.pid);s=consent(s,p.pid,other);
 assert.throws(()=>settle(s,p.pid),code('CORPORATE_APPROVAL_REQUIRED'));s=consent(s,p.pid,buyer);s=settle(s,p.pid);
 assert.equal(s.commerce!.companies[id].issuedShares,110000);assert.equal(s.commerce!.companies[id].shares[other],10000);reconcile(s);
 p=proposal(s,id,'buyback',{units:5000,holderCitizenId:s.citizens[other].id,amount:30000});s=vote(p.s,p.pid);
 assert.throws(()=>settle(s,p.pid),code('CORPORATE_APPROVAL_REQUIRED'));s=consent(s,p.pid,other);s=settle(s,p.pid);
 assert.equal(s.commerce!.companies[id].issuedShares,105000);assert.equal(s.commerce!.companies[id].shares[other],5000);reconcile(s);
 const tampered=structuredClone(s);tampered.commerce!.companies[id].shares[owner]++;assert.throws(()=>reconcile(tampered),/cap table/);
});
test('rejection, stale ownership, expiry and outsider privacy preserve refundable commitments',()=>{
 let {s,id}=corporateSetup();const pending=proposal(s,id,'dividend');s=vote(pending.s,pending.pid);s=vote(s,pending.pid,other,false);assert.equal(s.governance!.actions[pending.pid].status,'pending');
 const transfer=proposal(s,id,'transfer',{units:10,buyerCitizenId:s.citizens[buyer].id,amount:0});s=settle(vote(consent(transfer.s,transfer.pid),transfer.pid),transfer.pid);
 assert.throws(()=>vote(s,pending.pid),code('CORPORATE_ACTION_STALE'));
 assert.equal(citizenView(s,'outsider-one',now).governance.actions.length,0);
 s=run(s,'CancelCorporateAction',{proposalId:pending.pid}).state;reconcile(s);
 const expired=proposal(s,id,'transfer',{units:10,buyerCitizenId:s.citizens[other].id,amount:2000});s=consent(expired.s,expired.pid,other);
 assert.throws(()=>run(s,'ExpireCorporateAction',{proposalId:expired.pid}),code('CORPORATE_ACTION_PENDING'));
 s=run(s,'ExpireCorporateAction',{proposalId:expired.pid},other,now+7*DAY).state;assert.equal(s.balances['share-purchase:'+expired.pid],0);reconcile(s);
});
test('dividend minor-unit rounding is proportional after ownership changes and unrelated cash activity keeps votes valid',()=>{
 let {s,id}=corporateSetup();let p=proposal(s,id,'transfer',{units:33333,buyerCitizenId:s.citizens[buyer].id,amount:0});s=settle(vote(consent(p.s,p.pid),p.pid),p.pid);
 p=proposal(s,id,'dividend',{amount:2});s=p.s;s=run(s,'FundCompany',{companyId:id,amount:1,acceptGift:true}).state;
 s=vote(s,p.pid);const beforeOwner=s.balances['citizen:'+owner],beforeBuyer=s.balances['citizen:'+buyer];s=settle(s,p.pid);
 assert.equal(s.balances['citizen:'+owner]-beforeOwner,1);assert.equal(s.balances['citizen:'+buyer]-beforeBuyer,1);reconcile(s);
});
test('consented restructuring pauses new commitments while retaining reservations and can resume through approval',()=>{
 let {s,id}=corporateSetup();const vacant=run(s,'PostVacancy',{companyId:id,roleId:'cleaner',wage:25000,slots:1,reserveShifts:1,deadline:now+DAY,acceptTerms:true});s=vacant.state;
 const reserveBefore=s.balances['payroll:'+vacant.receipt.detail.vacancyId];
 const pause=proposal(s,id,'restructure',{amount:0});s=settle(vote(pause.s,pause.pid),pause.pid);
 assert.equal(s.commerce!.companies[id].status,'restructuring');assert.equal(s.balances['payroll:'+vacant.receipt.detail.vacancyId],reserveBefore);
 assert.throws(()=>run(s,'BuyNPCSupply',{companyId:id,goodsId:'fuel',quantity:1,acceptedUnitPrice:300}),code('COMPANY_COMMITMENTS_PAUSED'));
 assert.throws(()=>proposal(s,id,'liquidate',{amount:s.balances['company:'+id]}),code('COMPANY_OBLIGATIONS'));
 s=run(s,'CloseVacancy',{vacancyId:vacant.receipt.detail.vacancyId}).state;assert.equal(s.balances['payroll:'+vacant.receipt.detail.vacancyId],0);
 const resume=proposal(s,id,'resume',{amount:0});s=settle(vote(resume.s,resume.pid),resume.pid);assert.equal(s.commerce!.companies[id].status,'active');reconcile(s);
});
test('company closure cannot erase assets or pending approvals and requires all owners with exact final cash',()=>{
 let {s,id}=corporateSetup();const pending=proposal(s,id,'dividend',{amount:10});s=pending.s;
 assert.throws(()=>proposal(s,id,'liquidate',{amount:s.balances['company:'+id]}),code('COMPANY_OBLIGATIONS'));
 s=run(s,'CancelCorporateAction',{proposalId:pending.pid}).state;
 let deal=proposal(s,id,'transfer',{units:25000,buyerCitizenId:s.citizens[buyer].id,amount:0});s=settle(vote(consent(deal.s,deal.pid),deal.pid),deal.pid);
 assert.throws(()=>proposal(s,id,'liquidate',{amount:1}),code('FINAL_BALANCE_CHANGED'));
 let close=proposal(s,id,'liquidate',{amount:s.balances['company:'+id]});s=vote(close.s,close.pid);assert.throws(()=>settle(s,close.pid),code('CORPORATE_APPROVAL_REQUIRED'));
 s=consent(s,close.pid,buyer);s=run(s,'FundCompany',{companyId:id,amount:1,acceptGift:true}).state;assert.throws(()=>settle(s,close.pid),code('FINAL_BALANCE_CHANGED'));
 s=run(s,'CancelCorporateAction',{proposalId:close.pid}).state;close=proposal(s,id,'liquidate',{amount:s.balances['company:'+id]});s=consent(vote(close.s,close.pid),close.pid,buyer);
 const beforeOwner=s.balances['citizen:'+owner],beforeBuyer=s.balances['citizen:'+buyer];s=settle(s,close.pid);
 assert.equal(s.commerce!.companies[id].status,'closed');assert.equal(s.balances['company:'+id],0);assert.equal(s.balances['corporate:'+close.pid],0);
 assert.equal(s.balances['citizen:'+owner]-beforeOwner+s.balances['citizen:'+buyer]-beforeBuyer,500001);reconcile(s);
 assert.throws(()=>run(s,'BuyNPCSupply',{companyId:id,goodsId:'fuel',quantity:1,acceptedUnitPrice:300}),code('COMPANY_COMMITMENTS_PAUSED'));
 const stock=corporateSetup();stock.s=run(stock.s,'BuyNPCSupply',{companyId:stock.id,goodsId:'grain',quantity:1,acceptedUnitPrice:1000}).state;
 assert.throws(()=>proposal(stock.s,stock.id,'liquidate',{amount:stock.s.balances['company:'+stock.id]}),code('COMPANY_OBLIGATIONS'));
});
