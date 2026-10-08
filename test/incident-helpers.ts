import {execute,DAY} from '../src/domain.ts';
import type {State,Command} from '../src/domain.ts';
import {incidentRoll} from '../src/incidents.ts';
export const INCIDENT_START=10*DAY;
let sequence=0;
export const incidentCommand=(type:string,payload:Record<string,unknown>={}):Command=>({id:'incident_test_'+ ++sequence,type,payload});
export const incidentRun=(s:State,actor:string,type:string,payload:Record<string,unknown>,at:number)=>execute(s,actor,incidentCommand(type,payload),at);
export function homeExposureSetup(s:State,actor:string){const start=INCIDENT_START,reserve=incidentRun(s,actor,'ReservePropertyPurchase',{propertyId:'npc-Lagos-home',acceptedTotal:512500,acceptTerms:true},start);s=incidentRun(reserve.state,actor,'CompletePropertyPurchase',{purchaseId:reserve.receipt.detail.purchaseId},start).state;s=incidentRun(s,actor,'ConnectUtilities',{propertyId:'npc-Lagos-home',acceptedFee:5000},start).state;for(let day=1;day<=44;day++)s=incidentRun(s,actor,'InspectProperty',{propertyId:'npc-Lagos-home'},start+day*DAY).state;return s;}
export function exposeHome(s:State,actor:string,at:number){for(const [goodsId,quantity,acceptedUnitPrice] of [['energy',2,200],['water',4,100]] as const)s=incidentRun(s,actor,'BuyNPCSupply',{goodsId,quantity,acceptedUnitPrice},at).state;const command=incidentCommand('UseHomeUtilities',{propertyId:'npc-Lagos-home',acceptedBill:800}),source=actor+':'+command.id;
 // Control the private PRNG for a deterministic incident. Players cannot set the world seed.
 for(let n=0;n<10000;n++){s.life!.seed='isolated-incident-secret-'+n;if(incidentRoll(s,source)<1)break;}
 const result=execute(s,actor,command,at);return{state:result.state,command,incidentId:String((result.receipt.detail.incidentIds as string[])[0])};}
