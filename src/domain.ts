import { createHash } from 'node:crypto';
import {DAY,RULES,LESSONS} from './rules.ts';
export {DAY,RULES,LESSONS} from './rules.ts';
import { initialLife,provisionLife,lifeCommand,lifeView,activeNeeds } from './life.ts';
import type { LifeState,LifeCitizen } from './life.ts';
import { REGIONS,regionByName } from './geography.ts';
import { workCommand,workView } from './jobs.ts';
import {worldCommand,worldView,positionFor} from './world.ts';
import type {WorldState} from './world.ts';
import {educationCommand,educationView} from './education.ts';
import type {EducationState} from './education.ts';
import {foundationExam} from './curriculum.ts';
import {commerceCommand,commerceView,consumeNpcMeal} from './commerce.ts';
import type {CommerceState} from './commerce.ts';
import {employmentCommand,employmentView} from './employment.ts';
import type {EmploymentState} from './employment.ts';
import {financeCommand,financeView} from './finance.ts';
import type {FinanceState} from './finance.ts';
import {propertyCommand,propertyView} from './property.ts';
import type {PropertyState} from './property.ts';
import {mobilityCommand,mobilityView} from './mobility.ts';
import type {MobilityState} from './mobility.ts';
import {healthcareCommand,healthcareView} from './healthcare.ts';
import type {HealthcareState} from './healthcare.ts';
import {incidentsView} from './incidents.ts';
import type {IncidentState} from './incidents.ts';
import {insuranceCommand,insuranceView} from './insurance.ts';
import type {InsuranceState} from './insurance.ts';
import {governanceCommand,governanceView} from './governance.ts';
import type {GovernanceState} from './governance.ts';
import {guardNewCompanyCommitment} from './company-obligations.ts';
import {furnishingCommand,furnishingView} from './furnishing.ts';
import type {FurnishingState} from './furnishing.ts';
import {initialAppearance,appearanceCommand,appearanceView} from './appearance.ts';
import type {Appearance} from './appearance.ts';
import type {SessionsState} from './sessions.ts';
import {adminCommand,authoriseAdminCommand,isAdminCommand} from './admin.ts';
import type {AdminContext,AdminState} from './admin.ts';
import {homeVisitCommand,homeVisitsView,settleHomeVisits,homeVisitClosureHash} from './home-visits.ts';
import {relationshipCommand,relationshipsView,settleRelationships,relationshipClosureHash} from './relationships.ts';
import type {RelationshipState} from './relationships.ts';
import {publicCitizenReceipt} from './public-receipts.ts';



export class DomainError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 409) { super(message); this.code = code; this.status = status; }
}
export type Citizen = { id: string; actorId: string; name: string; state: string; enrolledAt: number; housing: string; protectionEndsAt: number; completedLessons: number[]; examAttempts: { at: number; score: number; passed: boolean }[]; certificate: null | { id: string; curriculumVersion: string; issuedAt: number }; lastShiftAt: number | null; reviewRequired: boolean; life?:LifeCitizen; appearance?:Appearance };
type Entry = { account: string; amount: number };
export type Receipt = { commandId: string; actorId: string; type: string; at: number; detail: Record<string, unknown> };
type StoredCommand = { fingerprint: string; receipt: Receipt };
export type State = { version: 1; worldId: string; citizens: Record<string, Citizen>; balances: Record<string, number>; journals: { id: string; at: number; reason: string; entries: Entry[] }[]; commands: Record<string, StoredCommand>; outbox: { id: string; type: string; actorId: string; at: number; payload: Record<string, unknown> }[]; npcSpend: Record<string, number>; life?:LifeState; world?:WorldState; education?:EducationState; commerce?:CommerceState; employment?:EmploymentState; finance?:FinanceState; property?:PropertyState; mobility?:MobilityState; healthcare?:HealthcareState; incidents?:IncidentState; insurance?:InsuranceState; governance?:GovernanceState; furnishing?:FurnishingState; sessions?:SessionsState; administration?:AdminState; relationships?:RelationshipState };
export type Command = { id: string; worldId?: string; expectedVersion?: number; type: string; payload: Record<string, unknown> };
export function initialState(): State { return { version: 1, worldId: 'development-world', citizens: {}, balances: {}, journals: [], commands: {}, outbox: [], npcSpend: {},life:initialLife() }; }
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function post(state: State, id: string, now: number, reason: string, entries: Entry[]) {
  entries=entries.filter(e=>e.amount!==0);
  if (entries.some(e => !Number.isSafeInteger(e.amount)) || entries.reduce((sum, e) => sum + BigInt(e.amount), 0n) !== 0n) throw new Error('Unbalanced journal');
  const next = { ...state.balances };
  for (const entry of entries) {
    const amount = (next[entry.account] ?? 0) + entry.amount;
    if (!Number.isSafeInteger(amount)) throw new Error('Balance overflow');
    if (!entry.account.startsWith('system:') && amount < 0) throw new DomainError('INSUFFICIENT_FUNDS', 'There are not enough available funds in the paying account.');
    next[entry.account] = amount;
  }
  state.balances = next;
  state.journals.push({ id, at: now, reason, entries });
}
function fail(code: string, message: string): never { throw new DomainError(code, message); }

export function execute(original: State, actorId: string, command: Command, now: number, context?:AdminContext): { state: State; receipt: Receipt; replayed: boolean } {
  if (!actorId || !/^[a-zA-Z0-9_-]{3,80}$/.test(actorId) || ['__proto__','constructor','prototype'].includes(actorId)) throw new DomainError('AUTH_REQUIRED', 'A valid authenticated actor is required.', 401);
  if (!command || !/^[a-zA-Z0-9_-]{8,100}$/.test(command.id) || !command.payload || typeof command.payload !== 'object' || Array.isArray(command.payload)) throw new DomainError('INVALID_COMMAND', 'Provide a valid command identifier and payload.', 400);
  for(const [field,value] of Object.entries(command.payload))if(field.endsWith('Id')&&typeof value==='string'&&['__proto__','constructor','prototype'].includes(value))throw new DomainError('INVALID_REFERENCE','Choose a valid recorded reference.',400);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid server clock');
  if (command.worldId !== undefined && command.worldId !== original.worldId) throw new DomainError('WORLD_MISMATCH', 'Refresh the selected world before continuing.', 409);
  const key = `${actorId}:${command.id}`;
  const fingerprint = createHash('sha256').update(canonical({ type: command.type, payload: command.payload, ...(command.expectedVersion === undefined ? {} : { expectedVersion: command.expectedVersion }) })).digest('hex');
  authoriseAdminCommand(original,actorId,command.type,context,now);
  const previous = original.commands[key];
  if (previous) {
    if (previous.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT', 'This request identifier was already used for a different action.');
    return { state: original, receipt: structuredClone(previous.receipt), replayed: true };
  }
  const state = structuredClone(original);
  const visitClosures=settleHomeVisits(state,now,key),relationshipClosures=settleRelationships(state,now,key);
  guardNewCompanyCommitment(state,command);
  let citizen = state.citizens[actorId];
  let detail: Record<string, unknown> = {};
  let handled:Record<string,unknown>|undefined=adminCommand(state,actorId,command,now,key,context);
  if(handled===undefined)for(const handler of [relationshipCommand,homeVisitCommand,appearanceCommand,furnishingCommand,worldCommand,educationCommand,lifeCommand,workCommand,commerceCommand,employmentCommand,financeCommand,propertyCommand,mobilityCommand,healthcareCommand,insuranceCommand,governanceCommand]){handled=handler(state,actorId,command,now,key);if(handled!==undefined)break;}
  if(handled!==undefined)detail=handled;
  else if (command.type === 'CreateCitizen') {
    if (citizen) fail('CITIZEN_EXISTS', 'This account already has a citizen in this world.');
    if (command.payload.adultConfirmed !== true) throw new DomainError('ADULT_REQUIRED', 'The initial service is for adults aged 18 and above.', 400);
    const name = typeof command.payload.name === 'string' ? command.payload.name.trim() : '';
    if (!/^[\p{L}\p{N} .'-]{2,40}$/u.test(name)) throw new DomainError('INVALID_NAME', 'Use a name containing 2 to 40 letters numbers or spaces.', 400);
    const region = command.payload.state;
    if (!regionByName(region)) throw new DomainError('INVALID_STATE', 'Choose a Nigerian state or FCT.', 400);
    state.life??=initialLife();
    citizen = { id: `citizen_${createHash('sha256').update(state.life.seed+':'+actorId).digest('hex').slice(0,24)}`, actorId, name, state: region as string, enrolledAt: now, housing: 'Starter accommodation', protectionEndsAt: now + 5 * DAY, completedLessons: [], examAttempts: [], certificate: null, lastShiftAt: null, reviewRequired: false,appearance:initialAppearance(command.payload.appearance) };
    state.citizens[actorId] = citizen;
    const allowance=provisionLife(state,citizen,command.payload.path,now,key);
    positionFor(state,citizen,now);
    post(state, key, now, 'Starter provision', [{ account: 'system:onboarding-issuance', amount: -allowance }, { account: `citizen:${actorId}`, amount: allowance }]);
    detail = { citizenId: citizen.id, housing: citizen.housing, amount: allowance,path:citizen.life?.path,appearance:{...citizen.appearance!} };
  } else {
    if (!citizen) fail('CITIZEN_REQUIRED', 'Create your citizen first.');
    if (command.type === 'BuyBasicMeal') {
      consumeNpcMeal(state,actorId,now,key);
      post(state, key, now, 'Basic meal', [{ account: `citizen:${actorId}`, amount: -RULES.basicMealCost }, { account: 'system:food-provider', amount: RULES.basicMealCost }]);
      activeNeeds(citizen,now);citizen.life!.needs.hunger=Math.min(100,citizen.life!.needs.hunger+35);
      detail = { amount: RULES.basicMealCost, item: 'Basic meal' };
    } else throw new DomainError('UNKNOWN_COMMAND', 'This command is not implemented.', 400);
  }
  visitClosures.push(...settleHomeVisits(state,now,key));
  relationshipClosures.push(...settleRelationships(state,now,key));
  if(relationshipClosures.length)detail.relationshipClosureProofs=relationshipClosures.map(relationshipClosureHash);
  if(visitClosures.length)detail.homeVisitClosureProofs=visitClosures.map(homeVisitClosureHash);
  const receipt: Receipt = { commandId: command.id, actorId, type: command.type, at: now, detail };
  state.commands[key] = { fingerprint, receipt };
  state.outbox.push({ id: key, type: command.type, actorId, at: now, payload: detail });
  return { state, receipt: structuredClone(receipt), replayed: false };
}

export function citizenView(state: State, actorId: string, now: number) {
  state=structuredClone(state);settleHomeVisits(state,now);settleRelationships(state,now);
  const citizen = state.citizens[actorId];
  return {
    worldId: state.worldId, serverTime: now, rulesVersion: RULES.version, citizen: citizen ?? null,
    balance: state.balances[`citizen:${actorId}`] ?? 0,
    lessons: LESSONS.map((title, index) => ({ day: index + 1, title, unlockAt: citizen ? citizen.enrolledAt + index * DAY : null, complete: citizen?.completedLessons.includes(index + 1) ?? false })),
    exam: citizen?foundationExam(state,actorId).questions.map(({id,question,answers})=>({id,question,answers})):[],
    examId:citizen?foundationExam(state,actorId).id:null,
    receipts: Object.values(state.commands).filter(c => c.receipt.actorId === actorId&&!isAdminCommand(c.receipt.type)).map(c => publicCitizenReceipt(state,c.receipt)).slice(-15),
    world:worldView(state,actorId,now),education:educationView(state,actorId,now),
    commerce:commerceView(state,actorId,now),
    employment:employmentView(state,actorId,now),
    finance:financeView(state,actorId,now),
    property:propertyView(state,actorId,now),
    furnishing:furnishingView(state,actorId,now),homeVisits:homeVisitsView(state,actorId,now),relationships:relationshipsView(state,actorId,now),appearance:appearanceView(state,actorId),
    mobility:mobilityView(state,actorId,now),
    healthcare:healthcareView(state,actorId,now),
    incidents:incidentsView(state,actorId),
    insurance:insuranceView(state,actorId,now),
    governance:governanceView(state,actorId,now),
    regions:REGIONS,life:lifeView(state,citizen??null,actorId,now),work:workView(state,actorId,now),
  };
}
