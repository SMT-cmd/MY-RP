import {reconcileAdministration} from './admin.ts';
import {reconcileSessions} from './sessions.ts';
import {reconcileAppearance} from './appearance.ts';
import { createHash } from 'node:crypto';
import type { State } from './domain.ts';
import {reconcileInsurance} from './insurance.ts';
import {reconcileIncidents} from './incidents.ts';
import {reconcileHealthcare} from './healthcare.ts';
import {reconcileMobility} from './mobility.ts';
import {reconcileProperty} from './property.ts';
import {reconcileStock} from './stock.ts';
import {reconcileGovernance} from './governance.ts';
import {streetWalkable,BUILDINGS} from './neighbourhood.ts';
import {regionByName} from './geography.ts';
import {homeTile} from './interiors.ts';
import {homeIdentity,homeWalkable,reconcileFurnishing} from './furnishing.ts';
import {authorisedInterior,reconcileHomeVisits} from './home-visits.ts';
import {reconcileRelationships} from './relationships.ts';
import {reconcileFurnitureUse} from './furniture-use.ts';

export function reconcile(state: State) {
  for(const [actor,position] of Object.entries(state.world?.positions??{})){
    if(!state.citizens[actor]||!regionByName(position.region)||!streetWalkable(position.x,position.y)||!Number.isSafeInteger(position.leaseVersion)||position.leaseVersion<1||position.interior!==null&&!BUILDINGS.some(b=>b.id===position.interior))throw new Error('Invalid authoritative street position');
    if(position.interior==='shelter'){
      const home=homeIdentity(state,actor);
      if(position.visitId?!authorisedInterior(state,actor):position.homeId&&position.homeId!==home.id||!position.homeId&&state.property?.assets[home.id])throw new Error('Home position lacks current residence permission');
    }
  }

  for(const position of Object.values(state.world?.positions??{}))if(position.interior==='shelter'&&(position.interiorX!==undefined||position.interiorY!==undefined)&&!(position.homeId&&state.furnishing?.homes[position.homeId]?homeWalkable(state,state.furnishing.homes[position.homeId],position.interiorX!,position.interiorY!):homeTile(position.interiorX!,position.interiorY!)))throw new Error('Invalid starter home position');
  reconcileAdministration(state);
  reconcileSessions(state);
  reconcileAppearance(state);
  reconcileFurnishing(state);
  reconcileHomeVisits(state);
  reconcileFurnitureUse(state);
  reconcileRelationships(state);
  reconcileStock(state);
  reconcileProperty(state);
  reconcileMobility(state);
  reconcileHealthcare(state);
  reconcileIncidents(state);
  reconcileInsurance(state);
  reconcileGovernance(state);
  for(const s of Object.values(state.finance?.savings??{}))if(!Number.isSafeInteger(s.principal)||s.principal<0||s.principal!==(state.balances['saving:'+s.id]??0)||!Number.isSafeInteger(s.owed)||s.owed<0)throw new Error('Savings reserve mismatch');
  for(const loan of Object.values(state.finance?.loans??{})){const remaining=loan.principal+loan.interest+loan.lateFee-loan.paid;if(!Number.isSafeInteger(remaining)||remaining<0||(loan.status==='paid'&&remaining!==0))throw new Error('Loan liability mismatch');}
  const accounts = new Map<string,number>(),journalIds = new Set<string>();
  for(const journal of state.journals){
    if(journalIds.has(journal.id)||journal.entries.length<2)throw new Error('Duplicate or incomplete journal');journalIds.add(journal.id);
    let sum=0n;for(const entry of journal.entries){if(!Number.isSafeInteger(entry.amount))throw new Error('Invalid journal amount');sum+=BigInt(entry.amount);const next=(accounts.get(entry.account)??0)+entry.amount;if(!Number.isSafeInteger(next))throw new Error('Journal overflow');accounts.set(entry.account,next);}
    if(sum!==0n)throw new Error('Unbalanced journal');
  }
  for(const key of new Set([...Object.keys(state.balances),...accounts.keys()])){
    const balance=state.balances[key]??0;
    if(!Number.isSafeInteger(balance)||balance!==(accounts.get(key)??0)||(!key.startsWith('system:')&&balance<0))throw new Error('Ledger balance mismatch');
  }
  const citizens=new Set<string>();for(const [actor,citizen] of Object.entries(state.citizens)){if(citizen.actorId!==actor||typeof citizen.id!=='string'||!citizen.id.startsWith('citizen_')||citizens.has(citizen.id))throw new Error('Citizen identity mismatch');citizens.add(citizen.id);}
  const eventIds=new Set<string>();
  for(const event of state.outbox){if(eventIds.has(event.id))throw new Error('Duplicate outbox event');eventIds.add(event.id);if(!state.commands[event.id])throw new Error('Orphan outbox event');}
  for(const [key,command] of Object.entries(state.commands))if(key!==`${command.receipt.actorId}:${command.receipt.commandId}`||!eventIds.has(key)||!/^[0-9a-f]{64}$/.test(command.fingerprint))throw new Error('Command integrity mismatch');
  return {worldId:state.worldId,journals:journalIds.size,accounts:accounts.size,commands:Object.keys(state.commands).length,events:eventIds.size};
}
export function exportBackup(state: State,now=Date.now()){
  const summary=reconcile(state),data=JSON.stringify(state);
  return {format:'simulator-backup-v1',createdAt:now,summary,sha256:createHash('sha256').update(data).digest('hex'),data};
}
export function restoreBackup(backup: ReturnType<typeof exportBackup>): State{
  if(backup.format!=='simulator-backup-v1'||typeof backup.data!=='string'||createHash('sha256').update(backup.data).digest('hex')!==backup.sha256)throw new Error('Backup integrity check failed');
  const state=JSON.parse(backup.data) as State;reconcile(state);return state;
}
