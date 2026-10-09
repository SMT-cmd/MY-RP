import {createHmac} from 'node:crypto';
import type {State} from './domain.ts';
export const CURRICULUM_VERSION='foundation-1.0';
const q=(id:string,day:number,question:string,correct:string,a:string,b:string,c:string)=>({id,day,question,answers:[correct,a,b,c],correct:0});
export const QUESTION_BANK=[
 q('shelter',1,'Where can an independent citizen recover after losing their housing?','Starter shelter','An inherited public office','A paid election ballot','Another citizen’s private home without consent'),
 q('food',1,'What restores hunger safely?','A recorded meal purchase or eligible assistance','Buying a cosmetic','Submitting a duplicate receipt','Changing the device clock'),
 q('work',1,'When can starter work begin?','On the first day','Only after a medicine licence','Only after paying real money','Only after winning office'),
 q('needs',1,'What happens to survival needs during a long absence?','They stop deteriorating at a published cap','They cause automatic permanent death','They debit unlimited medical bills','They transfer your character to a neighbour'),
 q('travel',1,'What should you review before booking travel?','Fare, route and arrival time','A stranger’s password','A promised teleport exploit','An extra citizenship reward'),
 q('pay',1,'What proves that a task wage was paid?','The recorded settlement receipt','A client animation alone','A chat promise alone','Repeating the request until money doubles'),
 q('clock',1,'Which clock decides a payment or lesson deadline?','The server clock','The player’s device clock','The richest citizen’s clock','A screenshot timestamp'),
 q('block',2,'How can you stop unwanted contact?','Use privacy, block and report controls','Share your password','Pay the sender','Surrender your wallet'),
 q('family',2,'What does joining a household do to personal money?','It remains yours unless you consent to a specific transfer','It belongs automatically to the owner','It becomes another member’s debt','It becomes an election vote'),
 q('leave',2,'Can a household force you to remain?','No; you can leave and recover through starter shelter','Yes if the owner is wealthy','Yes after an invitation','Yes if you failed an exam'),
 q('report',2,'What is useful in a harassment report?','The relevant messages or event references','Someone’s password','An invented conviction','A demand for their balance'),
 q('review',2,'What permits a customer review?','A verified completed transaction','A self-purchase to raise your score','A forged receipt','A paid review with no service'),
 q('consent',2,'What is required to join a partnership or household?','Each affected citizen’s consent','A third party’s command','A premium entitlement','A politician’s order'),
 q('escrow',3,'Which funds can be spent freely?','Available funds after reservations','Funds in another person’s payroll reserve','An unpaid promise','A disputed frozen balance'),
 q('contract',3,'What must you check before accepting work?','Duties, wage, secured pay and cancellation terms','Whether it grants a secret password','Whether a screenshot looks impressive','Whether it sells votes'),
 q('debt',3,'How is credit represented?','A disclosed liability contract','Free currency with no obligation','A hidden debit controlled by another player','An automatic professional licence'),
 q('tax',3,'Where does a recorded tax payment go?','The appropriate public treasury','A governor’s personal wallet','It disappears without an entry','It becomes a second ballot'),
 q('scholarship',3,'What may a restricted scholarship pay?','Approved tuition for its recipient','An election bribe','Unlimited personal cash withdrawals','Another citizen’s password'),
 q('retry',3,'What is the safe response to a payment timeout?','Retry the same action identifier to recover the result','Use a new identifier to collect twice','Edit the payer’s balance','Claim every animation is a payment'),
 q('budget',3,'How should you compare two prices?','Compare their total cost against available funds','Ignore fees and reserves','Assume future wages are already paid','Treat premium currency as treasury funds'),
 q('arrest',4,'Does arrest alone prove guilt?','No; a case needs review and adjudication','Yes, permanently','Only if a crowd demands it','Only if a cosmetic was purchased'),
 q('notice',4,'What should a lawful notice explain?','Grounds, authority, deadline and review route','A secret password request','A demand for real cash','A permanent ban with no reason'),
 q('appeal',4,'What can a citizen do about a reviewable decision?','Use the published appeal route','Delete the case evidence','Steal the judge’s account','Buy a different verdict'),
 q('vote',4,'What makes a ballot valid?','Published citizen eligibility and one accepted vote','Being an NPC','Repeated account retries','A purchased cosmetic'),
 q('office',4,'What limits an official’s power?','Scope, budgets, law and oversight','Their private wealth alone','Their chat popularity alone','Access to citizens’ passwords'),
 q('bail',4,'What is bail in the simulation?','A disclosed custody condition subject to legal review','A finding of guilt','An unlimited confiscation power','A way to inherit office'),
 q('medicine',5,'What opens a licensed clinical career?','The required course, exam, practice and current licence','A premium outfit','Family wealth alone','An arrest record alone'),
 q('tutor',5,'Can a player tutor invent an official certificate?','No; authoritative eligibility and exams control certification','Yes if they charge enough','Yes if they own a club','Yes by sending a private message'),
 q('failure',5,'What remains available after failing the foundation exam?','Starter work, shelter, care and free review','Only a paid retake','A guaranteed professional role','An extra citizenship allowance'),
 q('ordinary',5,'Must every citizen become rich or hold office?','No; ordinary comfortable life is a valid goal','Yes or their account is deleted','Yes to access basic food','Yes to retain privacy'),
 q('legacy',5,'What can a verified legacy contribution preserve?','History and voluntary stewardship','Inherited votes','Permanent legal immunity','Another citizen’s private messages'),
 q('licence',5,'What must a professional check before acting?','That the relevant licence is current and in scope','That their avatar looks official','That their family is wealthy','That they can change the device clock'),
 q('fallback',5,'What happens when an official instructor is absent?','Approved NPC teaching or transfer keeps learning available','Your tuition vanishes','All earned credentials expire immediately','You must buy a real money item')
];
export function foundationExam(state:State,actor:string){
 const c=state.citizens[actor],seed=state.life!.seed,attempt=c.examAttempts.length;
 const hash=(s:string)=>createHmac('sha256',seed).update(actor+':'+attempt+':'+s).digest('hex');
 const selected=[1,2,3,4,5].flatMap(day=>QUESTION_BANK.filter(q=>q.day===day).sort((a,b)=>hash(a.id).localeCompare(hash(b.id))).slice(0,4));
 const questions=selected.sort((a,b)=>hash('order:'+a.id).localeCompare(hash('order:'+b.id))).map(q=>{
  const indexes=[0,1,2,3].sort((a,b)=>hash(q.id+':answer:'+a).localeCompare(hash(q.id+':answer:'+b)));
  return{...q,answers:indexes.map(i=>q.answers[i]),correct:indexes.indexOf(q.correct)};
 });
 return{id:'exam_'+hash('id').slice(0,24),version:CURRICULUM_VERSION,questions};
}
