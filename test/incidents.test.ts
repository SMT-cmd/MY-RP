import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,DAY,DomainError} from '../src/domain.ts';
import type {State,Command} from '../src/domain.ts';
import {incidentRoll} from '../src/incidents.ts';
import {reconcile} from '../src/recovery.ts';
import {INCIDENT_START,incidentRun,homeExposureSetup,exposeHome} from './incident-helpers.ts';
test('measured home deterioration produces real incidents, repair evidence and an urgent clinical journey without client severity',()=>{
 const actor='incident-person',start=INCIDENT_START;let s=incidentRun(initialState(),actor,'CreateCitizen',{name:'Incident citizen',state:'Lagos',adultConfirmed:true},start).state;s=homeExposureSetup(s,actor);
 const first=exposeHome(s,actor,start+46*DAY);s=first.state;assert.equal(s.citizens[actor].life!.needs.health,80);assert.equal(Object.values(s.incidents!.records).length,1);assert.equal(execute(s,actor,first.command,start+46*DAY+100).replayed,true);assert.equal(s.citizens[actor].life!.needs.health,80);
 s=exposeHome(s,actor,start+47*DAY).state;assert.equal(s.citizens[actor].life!.needs.health,60);assert.equal(Object.values(s.incidents!.records).length,2);
 const at=start+47*DAY+1000,intake=incidentRun(s,actor,'RequestAssessment',{providerId:'npc',acceptedConsultation:0,consent:true,severity:'healthy'},at);s=intake.state;const caseId=String(intake.receipt.detail.caseId);s=incidentRun(s,actor,'AssessPatient',{caseId,choice:0,severity:'healthy'},at+2000).state;assert.equal(s.healthcare!.cases[caseId].condition,'urgent');assert.equal(s.healthcare!.cases[caseId].incidentId,Object.values(s.incidents!.records)[1].id);
 s=incidentRun(s,actor,'RequestEmergencyTransport',{caseId},at+2001).state;const trip=s.world!.trips[s.world!.activeTrips[actor]];assert.throws(()=>incidentRun(s,actor,'MoveCitizen',{dx:1,dy:0},at+3000),(e:unknown)=>e instanceof DomainError&&e.code==='IN_TRANSIT');s=incidentRun(s,actor,'ArriveTravel',{},trip.arriveAt).state;s=incidentRun(s,actor,'AcceptTreatment',{caseId,acceptedFee:2500,acceptTerms:true},trip.arriveAt+1).state;s=incidentRun(s,actor,'TreatPatient',{caseId,choice:0},trip.arriveAt+2).state;s=incidentRun(s,actor,'CompleteRecovery',{caseId},trip.arriveAt+60002).state;assert.equal(s.citizens[actor].life!.needs.health,100);
 s=incidentRun(s,actor,'BuyNPCSupply',{goodsId:'materials',quantity:2,acceptedUnitPrice:2000},trip.arriveAt+60003).state;s=incidentRun(s,actor,'RepairProperty',{propertyId:'npc-Lagos-home',acceptedFee:10000},trip.arriveAt+60004).state;const invoice=Object.values(s.incidents!.records)[1].invoice;assert.equal(invoice?.amount,10000);assert.equal(invoice?.actor,actor);reconcile(s);
});
