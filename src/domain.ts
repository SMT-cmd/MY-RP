import { createHash } from 'node:crypto';

export const DAY = 86_400_000;
export const RULES = { version: 'development-0.1', starterCash: 2_000_000, shiftPay: 25_000, dailyNpcBudget: 100_000, shiftCooldown: 60_000, basicMealCost: 5_000 };
export const LESSONS = ['Survival and work', 'Society and safety', 'Money and contracts', 'Law and citizenship', 'Progression and legacy'];
export const EXAM = [
  { id: 'survival', question: 'What can help you recover after running out of money?', answers: ['NPC starter work and basic assistance', 'Buying an election vote'], correct: 0 },
  { id: 'privacy', question: 'What should you do about unwanted messages?', answers: ['Share your password', 'Use block and report controls'], correct: 1 },
  { id: 'money', question: 'Which balance is available to spend?', answers: ['All funds including escrow', 'Funds remaining after reservations'], correct: 1 },
  { id: 'law', question: 'Does an arrest alone establish guilt?', answers: ['No a case requires review and adjudication', 'Yes automatically'], correct: 0 },
  { id: 'career', question: 'What opens a licensed professional career?', answers: ['The required education exams and current licence', 'A premium cosmetic item'], correct: 0 },
];

export class DomainError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 409) { super(message); this.code = code; this.status = status; }
}
type Citizen = { id: string; actorId: string; name: string; state: string; enrolledAt: number; housing: string; protectionEndsAt: number; completedLessons: number[]; examAttempts: { at: number; score: number; passed: boolean }[]; certificate: null | { id: string; curriculumVersion: string; issuedAt: number }; lastShiftAt: number | null; reviewRequired: boolean };
type Entry = { account: string; amount: number };
type Receipt = { commandId: string; actorId: string; type: string; at: number; detail: Record<string, unknown> };
type StoredCommand = { fingerprint: string; receipt: Receipt };
export type State = { version: 1; worldId: string; citizens: Record<string, Citizen>; balances: Record<string, number>; journals: { id: string; at: number; reason: string; entries: Entry[] }[]; commands: Record<string, StoredCommand>; outbox: { id: string; type: string; actorId: string; at: number; payload: Record<string, unknown> }[]; npcSpend: Record<string, number> };
export type Command = { id: string; type: 'CreateCitizen' | 'CompleteShift' | 'BuyBasicMeal' | 'CompleteLesson' | 'SubmitExam'; payload: Record<string, unknown> };
export function initialState(): State { return { version: 1, worldId: 'development-world', citizens: {}, balances: {}, journals: [], commands: {}, outbox: [], npcSpend: {} }; }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(value);
}
function post(state: State, id: string, now: number, reason: string, entries: Entry[]) {
  if (entries.some(e => !Number.isSafeInteger(e.amount)) || entries.reduce((sum, e) => sum + e.amount, 0) !== 0) throw new Error('Unbalanced journal');
  const next = { ...state.balances };
  for (const entry of entries) {
    const amount = (next[entry.account] ?? 0) + entry.amount;
    if (!Number.isSafeInteger(amount)) throw new Error('Balance overflow');
    if (entry.account.startsWith('citizen:') && amount < 0) throw new DomainError('INSUFFICIENT_FUNDS', 'You do not have enough available funds.');
    next[entry.account] = amount;
  }
  state.balances = next;
  state.journals.push({ id, at: now, reason, entries });
}
function fail(code: string, message: string): never { throw new DomainError(code, message); }

export function execute(original: State, actorId: string, command: Command, now: number): { state: State; receipt: Receipt; replayed: boolean } {
  if (!actorId || !/^[a-zA-Z0-9_-]{3,80}$/.test(actorId)) throw new DomainError('AUTH_REQUIRED', 'A valid authenticated actor is required.', 401);
  if (!command || !/^[a-zA-Z0-9_-]{8,100}$/.test(command.id) || !command.payload || typeof command.payload !== 'object' || Array.isArray(command.payload)) throw new DomainError('INVALID_COMMAND', 'Provide a valid command identifier and payload.', 400);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid server clock');
  const key = `${actorId}:${command.id}`;
  const fingerprint = createHash('sha256').update(canonical({ type: command.type, payload: command.payload })).digest('hex');
  const previous = original.commands[key];
  if (previous) {
    if (previous.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT', 'This request identifier was already used for a different action.');
    return { state: original, receipt: structuredClone(previous.receipt), replayed: true };
  }
  const state = structuredClone(original);
  let citizen = state.citizens[actorId];
  let detail: Record<string, unknown> = {};
  if (command.type === 'CreateCitizen') {
    if (citizen) fail('CITIZEN_EXISTS', 'This account already has a citizen in this world.');
    if (command.payload.adultConfirmed !== true) throw new DomainError('ADULT_REQUIRED', 'The initial service is for adults aged 18 and above.', 400);
    const name = typeof command.payload.name === 'string' ? command.payload.name.trim() : '';
    if (!/^[\p{L}\p{N} .'-]{2,40}$/u.test(name)) throw new DomainError('INVALID_NAME', 'Use a name containing 2 to 40 letters numbers or spaces.', 400);
    // The whole geography catalogue remains R001 scope; these are fixture regions only.
    const region = command.payload.state;
    if (!['Lagos', 'Ogun', 'Kano', 'FCT'].includes(region as string)) throw new DomainError('INVALID_STATE', 'Choose a supported development region.', 400);
    citizen = { id: `citizen_${actorId}`, actorId, name, state: region as string, enrolledAt: now, housing: 'Starter accommodation', protectionEndsAt: now + 5 * DAY, completedLessons: [], examAttempts: [], certificate: null, lastShiftAt: null, reviewRequired: false };
    state.citizens[actorId] = citizen;
    post(state, key, now, 'Starter provision', [{ account: 'system:onboarding-issuance', amount: -RULES.starterCash }, { account: `citizen:${actorId}`, amount: RULES.starterCash }]);
    detail = { citizenId: citizen.id, housing: citizen.housing, amount: RULES.starterCash };
  } else {
    if (!citizen) fail('CITIZEN_REQUIRED', 'Create your citizen first.');
    if (command.type === 'CompleteShift') {
      if (citizen.lastShiftAt !== null && now - citizen.lastShiftAt < RULES.shiftCooldown) fail('SHIFT_COOLDOWN', 'Your next starter shift is not available yet.');
      const day = Math.floor(now / DAY).toString();
      const spend = state.npcSpend[day] ?? 0;
      if (spend + RULES.shiftPay > RULES.dailyNpcBudget) fail('NPC_BUDGET_LIMIT', 'The development employer daily wage budget is committed.');
      post(state, key, now, 'NPC starter shift', [{ account: 'system:npc-wage-issuance', amount: -RULES.shiftPay }, { account: `citizen:${actorId}`, amount: RULES.shiftPay }]);
      citizen.lastShiftAt = now; state.npcSpend[day] = spend + RULES.shiftPay;
      detail = { amount: RULES.shiftPay, job: 'Cleaner', nextShiftAt: now + RULES.shiftCooldown };
    } else if (command.type === 'BuyBasicMeal') {
      post(state, key, now, 'Basic meal', [{ account: `citizen:${actorId}`, amount: -RULES.basicMealCost }, { account: 'system:food-provider', amount: RULES.basicMealCost }]);
      detail = { amount: RULES.basicMealCost, item: 'Basic meal' };
    } else if (command.type === 'CompleteLesson') {
      const day = command.payload.day;
      if (!Number.isInteger(day) || (day as number) < 1 || (day as number) > 5) throw new DomainError('INVALID_LESSON', 'Choose lesson 1 to 5.', 400);
      if (now < citizen.enrolledAt + ((day as number) - 1) * DAY) fail('LESSON_LOCKED', 'This foundation module has not unlocked yet.');
      if ((day as number) > 1 && !citizen.completedLessons.includes((day as number) - 1)) fail('PREREQUISITE_REQUIRED', 'Complete the previous module first.');
      if (!citizen.completedLessons.includes(day as number)) citizen.completedLessons.push(day as number);
      if (day === 5) citizen.reviewRequired = false;
      detail = { day, title: LESSONS[(day as number) - 1] };
    } else if (command.type === 'SubmitExam') {
      if (citizen.certificate) fail('ALREADY_CERTIFIED', 'Your foundation certificate is already recorded.');
      if (citizen.completedLessons.length !== 5 || now < citizen.enrolledAt + 4 * DAY) fail('EXAM_LOCKED', 'Complete all five foundation modules first.');
      if (citizen.reviewRequired) fail('REVIEW_REQUIRED', 'Review module five before retaking the exam.');
      const answers = command.payload.answers;
      if (!Array.isArray(answers) || answers.length !== EXAM.length || answers.some(a => !Number.isInteger(a) || a < 0 || a > 1)) throw new DomainError('INVALID_EXAM', 'Answer all examination questions.', 400);
      const score = Math.round(100 * EXAM.filter((q, i) => q.correct === answers[i]).length / EXAM.length);
      const passed = score >= 80;
      citizen.examAttempts.push({ at: now, score, passed }); citizen.reviewRequired = !passed;
      if (passed) citizen.certificate = { id: `foundation_${citizen.id}`, curriculumVersion: RULES.version, issuedAt: now };
      detail = { score, passed, certificate: citizen.certificate };
    } else throw new DomainError('UNKNOWN_COMMAND', 'This command is not implemented.', 400);
  }
  const receipt: Receipt = { commandId: command.id, actorId, type: command.type, at: now, detail };
  state.commands[key] = { fingerprint, receipt };
  state.outbox.push({ id: key, type: command.type, actorId, at: now, payload: detail });
  return { state, receipt: structuredClone(receipt), replayed: false };
}

export function citizenView(state: State, actorId: string, now: number) {
  const citizen = state.citizens[actorId];
  return {
    worldId: state.worldId, serverTime: now, rulesVersion: RULES.version, citizen: citizen ?? null,
    balance: state.balances[`citizen:${actorId}`] ?? 0,
    lessons: LESSONS.map((title, index) => ({ day: index + 1, title, unlockAt: citizen ? citizen.enrolledAt + index * DAY : null, complete: citizen?.completedLessons.includes(index + 1) ?? false })),
    exam: EXAM.map(({ id, question, answers }) => ({ id, question, answers })),
    receipts: Object.values(state.commands).filter(c => c.receipt.actorId === actorId).map(c => c.receipt).slice(-15),
  };
}
