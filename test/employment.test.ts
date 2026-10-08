import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,DAY,DomainError} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {graduate,completeCourse} from './helpers.ts';
import {reconcile} from '../src/recovery.ts';
let seq=0;const start=10*DAY,now=start+7*DAY,owner='employer-one',worker='worker-one';
const run=(s:State,actor:string,type:string,payload:Record<string,unknown>={},at=now)=>execute(s,actor,{id:'hiring_test_'+ ++seq,type,payload},at);
const code=(value:string)=>(e:unknown)=>e instanceof DomainError&&e.code===value;
function setup(){let s=run(initialState(),owner,'CreateCitizen',{name:'Owner',state:'Lagos',adultConfirmed:true},start).state;s=graduate(s,owner,start);s=completeCourse(s,owner,'secondary',start+5*DAY);s=completeCourse(s,owner,'business',start+6*DAY);const formed=run(s,owner,'RegisterCompany',{name:'Workers Ltd',sector:'services',capital:200000});s=formed.state;s=run(s,worker,'CreateCitizen',{name:'Worker',state:'Lagos',adultConfirmed:true},start).state;return{s,companyId:String(formed.receipt.detail.companyId)};}
function hire(s:State,companyId:string){const posted=run(s,owner,'PostVacancy',{companyId,roleId:'cleaner',wage:50000,slots:1,reserveShifts:2,deadline:now+DAY,acceptTerms:true});s=posted.state;const vacancyId=String(posted.receipt.detail.vacancyId),applied=run(s,worker,'ApplyForJob',{vacancyId});s=applied.state;const applicationId=applied.receipt.detail.applicationId;
 s=run(s,owner,'ReviewApplication',{applicationId,reason:'Relevant duties and availability checked'}).state;s=run(s,owner,'OfferInterview',{applicationId}).state;s=run(s,worker,'CompleteInterview',{applicationId,answers:[0,0]}).state;s=run(s,owner,'OfferEmployment',{applicationId}).state;const hired=run(s,worker,'AcceptEmployment',{applicationId,acceptTerms:true});return{s:hired.state,contractId:String(hired.receipt.detail.contractId),vacancyId};}
test('hiring needs funded vacancies, relevant eligibility, interview and worker consent',()=>{
 let {s,companyId}=setup();assert.throws(()=>run(s,worker,'PostVacancy',{companyId,roleId:'cleaner',wage:25000,slots:1,reserveShifts:1,deadline:now+DAY,acceptTerms:true,role:'ceo'}),code('COMPANY_PERMISSION'));
 assert.throws(()=>run(s,owner,'PostVacancy',{companyId,roleId:'cleaner',wage:1000000,slots:1,reserveShifts:4,deadline:now+DAY,acceptTerms:true}),code('INSUFFICIENT_FUNDS'));
 const posted=run(s,owner,'PostVacancy',{companyId,roleId:'accountant',wage:25000,slots:1,reserveShifts:1,deadline:now+DAY,acceptTerms:true});s=posted.state;assert.throws(()=>run(s,worker,'ApplyForJob',{vacancyId:posted.receipt.detail.vacancyId}),code('JOB_CREDENTIAL_REQUIRED'));
 const hired=hire(s,companyId);s=hired.s;assert.equal(s.balances['payroll:'+hired.contractId],100000);assert.equal(s.commerce!.companies[companyId].members[worker],'employee');assert.equal(s.commerce!.companies[companyId].shares[worker],undefined);reconcile(s);
});
test('earned work settles after employer absence and termination without double wages',()=>{
 let {s,companyId}=setup();const hired=hire(s,companyId);s=hired.s;const contractId=hired.contractId,before=s.balances['citizen:'+worker];s=run(s,worker,'BeginContractWork',{contractId}).state;
 for(const [i,choice] of [0,1,0].entries())s=run(s,worker,'ContractWorkStep',{contractId,choice},now+(i+1)*2000).state;
 assert.throws(()=>run(s,owner,'SettleContractWork',{contractId},now+60000),code('WORKER_PERMISSION'));s=run(s,owner,'GiveEmploymentNotice',{contractId,reason:'Company restructuring'},now+10000).state;s=run(s,owner,'FinishEmployment',{contractId},now+DAY+10000).state;
 assert.equal(s.balances['payroll:'+contractId],0);const paid={id:'earned_pay_unique',type:'SettleContractWork',payload:{contractId}};s=execute(s,worker,paid,now+DAY+10001).state;assert.equal(execute(s,worker,paid,now+10*DAY).replayed,true);assert.equal(s.balances['citizen:'+worker],before+48750);assert.equal(s.employment!.contracts[contractId].status,'terminated');assert.equal(s.balances['escrow:'+Object.keys(s.employment!.shifts)[0]],0);reconcile(s);
});
test('closing advertised work refunds only uncommitted reserves and workers can leave safely',()=>{
 let {s,companyId}=setup();const hired=hire(s,companyId);s=hired.s;s=run(s,owner,'CloseVacancy',{vacancyId:hired.vacancyId}).state;assert.equal(s.balances['payroll:'+hired.contractId],100000);
 s=run(s,worker,'GiveEmploymentNotice',{contractId:hired.contractId,reason:'Voluntary resignation'}).state;assert.throws(()=>run(s,worker,'FinishEmployment',{contractId:hired.contractId},now+DAY-1),code('NOTICE_PENDING'));
 s=run(s,worker,'FinishEmployment',{contractId:hired.contractId},now+DAY).state;assert.equal(s.balances['payroll:'+hired.contractId],0);assert.equal(s.commerce!.companies[companyId].members[worker],undefined);reconcile(s);
});
test('restructuring preserves earned worker pay and existing contracts while blocking new commitments',()=>{
 let {s,companyId}=setup();const hired=hire(s,companyId);s=hired.s;const contractId=hired.contractId,before=s.balances['citizen:'+worker];
 s=run(s,worker,'BeginContractWork',{contractId}).state;
 const paused=run(s,owner,'ProposeCorporateAction',{companyId,kind:'restructure',amount:0,acceptTerms:true});s=paused.state;
 s=run(s,owner,'ExecuteCorporateAction',{proposalId:paused.receipt.detail.proposalId}).state;
 assert.throws(()=>run(s,owner,'ReservePayroll',{contractId,shifts:1,acceptTerms:true}),code('COMPANY_COMMITMENTS_PAUSED'));
 assert.throws(()=>run(s,worker,'ApplyForJob',{vacancyId:hired.vacancyId}),code('COMPANY_COMMITMENTS_PAUSED'));
 assert.throws(()=>run(s,owner,'OpenSchool',{companyId,courses:['secondary']}),code('COMPANY_COMMITMENTS_PAUSED'));
 for(const [i,choice] of [0,1,0].entries())s=run(s,worker,'ContractWorkStep',{contractId,choice},now+(i+1)*2000).state;
 s=run(s,worker,'SettleContractWork',{contractId},now+60000).state;
 assert.equal(s.balances['citizen:'+worker]-before,48750);
 assert.throws(()=>run(s,owner,'ProposeCorporateAction',{companyId,kind:'liquidate',amount:s.balances['company:'+companyId],acceptTerms:true}),code('COMPANY_OBLIGATIONS'));
 s=run(s,owner,'CloseVacancy',{vacancyId:hired.vacancyId}).state;
 s=run(s,worker,'GiveEmploymentNotice',{contractId,reason:'Voluntary resignation during restructuring'}).state;
 s=run(s,worker,'FinishEmployment',{contractId},now+DAY).state;reconcile(s);
});
