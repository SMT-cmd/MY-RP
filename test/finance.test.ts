import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,DAY,DomainError,citizenView} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {firstDay,graduate} from './helpers.ts';
import {reconcile} from '../src/recovery.ts';
let seq=0;const start=10*DAY,actor='saver-one';
const run=(s:State,type:string,payload:Record<string,unknown>={},now=start,who=actor)=>execute(s,who,{id:'finance_test_'+ ++seq,type,payload},now);
const code=(value:string)=>(e:unknown)=>e instanceof DomainError&&e.code===value;
const create=()=>run(initialState(),'CreateCitizen',{name:'Saver',state:'Lagos',adultConfirmed:true}).state;
test('reserved savings use time-weighted accrual and cap offline interest without locking principal',()=>{
 let s=create(),before=s.balances['citizen:'+actor];const deposited=run(s,'DepositSavings',{providerId:'npc',amount:100000,acceptedRateBps:100,acceptTerms:true});s=deposited.state;const savingsId=deposited.receipt.detail.savingsId;
 s=run(s,'DepositSavings',{providerId:'npc',amount:100000,acceptedRateBps:100,acceptTerms:true},start+DAY-1).state;const projection=citizenView(s,actor,start+DAY).finance.savings[0];assert.equal(projection.owed,33,'A last-millisecond deposit cannot earn a full day’s interest');
 const paid={id:'savings_interest_unique',type:'CollectSavingsInterest',payload:{savingsId}};s=execute(s,actor,paid,start+90*DAY).state;assert.equal(execute(s,actor,paid,start+91*DAY).replayed,true);assert.equal(s.finance!.savings[String(savingsId)].paidInterest,2033);
 s=run(s,'WithdrawSavings',{savingsId,amount:200000},start+90*DAY).state;assert.equal(s.balances['saving:'+savingsId],0);assert.equal(s.balances['citizen:'+actor],before+2033);reconcile(s);
});
test('loan offers verify wages, disclose liability and cap late fees with hardship and repayment',()=>{
 let s=create();assert.throws(()=>run(s,'RequestLoan',{providerId:'npc',principal:50000,acceptedInterestBps:500,acceptTerms:true}),code('LOAN_AFFORDABILITY'));s=firstDay(s,actor,start);
 const borrowed=run(s,'RequestLoan',{providerId:'npc',principal:50000,acceptedInterestBps:500,acceptTerms:true},start+100000);s=borrowed.state;const loanId=borrowed.receipt.detail.loanId;
 assert.throws(()=>run(s,'RequestLoan',{providerId:'npc',principal:100000,acceptedInterestBps:500,acceptTerms:true},start+100001),code('LOAN_AFFORDABILITY'));
 s=run(s,'RequestLoanHardship',{loanId},start+DAY).state;assert.throws(()=>run(s,'RequestLoanHardship',{loanId},start+DAY),code('HARDSHIP_USED'));
 s=run(s,'ReviewLoan',{loanId},start+90*DAY).state;assert.equal(s.finance!.loans[String(loanId)].lateFee,5000);s=run(s,'ReviewLoan',{loanId},start+180*DAY).state;assert.equal(s.finance!.loans[String(loanId)].lateFee,5000);
 const repay={id:'loan_pay_unique',type:'RepayLoan',payload:{loanId,amount:57500}};s=execute(s,actor,repay,start+180*DAY).state;assert.equal(execute(s,actor,repay,start+181*DAY).replayed,true);assert.equal(s.finance!.loans[String(loanId)].status,'paid');reconcile(s);
});
test('tuition credit remains restricted and peer transfers respect identity, funds, block and retry',()=>{
 let s=graduate(create(),actor,start);const now=start+5*DAY;const funded=run(s,'RequestLoan',{providerId:'npc',principal:50000,courseId:'secondary',acceptedInterestBps:500,acceptTerms:true},now);s=funded.state;const loan=s.finance!.loans[String(funded.receipt.detail.loanId)];assert.equal(s.balances['scholarship:'+loan.educationAward],50000);
 const before=s.balances['citizen:'+actor];s=run(s,'EnrollCourse',{courseId:'secondary',acceptedFee:50000,acceptTerms:true,scholarshipId:loan.educationAward},now).state;assert.equal(s.balances['citizen:'+actor],before);
 s=run(s,'CreateCitizen',{name:'Other',state:'Ogun',adultConfirmed:true},now,'other-one').state;const recipient=s.citizens['other-one'].id,payment={id:'peer_transfer_unique',type:'TransferMoney',payload:{citizenId:recipient,confirmRecipient:recipient,amount:1000}};s=execute(s,actor,payment,now).state;assert.equal(execute(s,actor,payment,now+DAY).replayed,true);
 s=run(s,'BlockCitizen',{citizenId:recipient},now).state;assert.throws(()=>run(s,'TransferMoney',{citizenId:recipient,confirmRecipient:recipient,amount:1000},now),code('CONTACT_BLOCKED'));reconcile(s);
});
test('unused education credit cancellation returns funding and restores earlier principal payments',()=>{
 let s=graduate(create(),actor,start),now=start+5*DAY;const loaned=run(s,'RequestLoan',{providerId:'npc',principal:50000,courseId:'secondary',acceptedInterestBps:500,acceptTerms:true},now);s=loaned.state;const loanId=String(loaned.receipt.detail.loanId),before=s.balances['citizen:'+actor];s=run(s,'RepayLoan',{loanId,amount:10000},now+1000).state;
 const cancelled={id:'education_credit_cancel_unique',type:'CancelEducationLoan',payload:{loanId}};s=execute(s,actor,cancelled,now+2000).state;assert.equal(execute(s,actor,cancelled,now+3000).replayed,true);assert.equal(s.balances['citizen:'+actor],before);assert.equal(s.finance!.loans[loanId].status,'paid');assert.equal(s.finance!.loans[loanId].waived,2500);reconcile(s);
});
