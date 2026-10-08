import {DomainError} from './domain.ts';
import type {State,Command} from './domain.ts';

// Summaries intentionally omit patient/student identity and private case data.
export function companyObligations(s:State,company:string,exceptAction?:string){
 const result:{kind:string;count:number}[]=[],add=(kind:string,count:number)=>{if(count)result.push({kind,count});};
 add('Available inventory units',Object.values(s.commerce?.batches??{}).filter(b=>b.owner==='company:'+company).reduce((n,b)=>n+b.quantity,0));
 add('Open goods listings',Object.values(s.commerce?.listings??{}).filter(l=>l.company===company&&l.status==='open').length);
 add('Unsettled customer orders',Object.values(s.commerce?.orders??{}).filter(o=>o.company===company&&!['accepted','cancelled','refunded'].includes(o.status)).length);
 add('Running production batches',Object.values(s.commerce?.production??{}).filter(p=>p.company===company&&p.status==='running').length);
 add('Open or reserved vacancies',Object.values(s.employment?.vacancies??{}).filter(v=>v.company===company&&(v.status==='open'||(s.balances['payroll:'+v.id]??0)>0)).length);
 add('Active employment agreements',Object.values(s.employment?.contracts??{}).filter(c=>c.company===company&&c.status!=='terminated').length);
 add('Earned or committed worker shifts',Object.values(s.employment?.shifts??{}).filter(w=>s.employment?.contracts[w.contract]?.company===company&&w.status==='active').length);
 const banks=new Set(Object.values(s.finance?.institutions??{}).filter(b=>b.company===company).map(b=>b.id));
 add('Open financial institutions',Object.values(s.finance?.institutions??{}).filter(b=>b.company===company&&b.active).length);
 add('Deposits or unpaid savings interest',Object.values(s.finance?.savings??{}).filter(a=>banks.has(a.provider)&&(a.principal>0||a.owed>0)).length);
 add('Outstanding loan assets',Object.values(s.finance?.loans??{}).filter(l=>banks.has(l.provider)&&l.status!=='paid').length);
 const schools=new Set(Object.values(s.education?.schools??{}).filter(a=>a.company===company).map(a=>a.id));
 add('Open private schools',Object.values(s.education?.schools??{}).filter(a=>a.company===company&&a.status==='open').length);
 add('Unfinished private education',Object.values(s.education?.enrolments??{}).filter(a=>a.schoolId&&schools.has(a.schoolId)&&!['completed','cancelled'].includes(a.status)).length);
 const hospitals=new Set(Object.values(s.healthcare?.hospitals??{}).filter(a=>a.company===company).map(a=>a.id));
 add('Open clinical facilities',Object.values(s.healthcare?.hospitals??{}).filter(a=>a.company===company&&a.active).length);
 add('Unfinished clinical commitments',Object.values(s.healthcare?.cases??{}).filter(a=>hospitals.has(a.provider)&&!['completed','cancelled'].includes(a.status)).length);
 const insurers=new Set(Object.values(s.insurance?.providers??{}).filter(a=>a.company===company).map(a=>a.id));
 add('Open insurance providers',Object.values(s.insurance?.providers??{}).filter(a=>a.company===company&&a.active).length);
 const policies=new Set(Object.values(s.insurance?.policies??{}).filter(a=>insurers.has(a.provider)).map(a=>a.id));
 add('Insurance policies still holding obligations',Object.values(s.insurance?.policies??{}).filter(a=>insurers.has(a.provider)&&a.status==='active').length);
 add('Unsettled insurance claims',Object.values(s.insurance?.claims??{}).filter(a=>policies.has(a.policy)&&!['paid','denied'].includes(a.status)).length);
 add('Other pending company approvals',Object.values(s.governance?.actions??{}).filter(a=>a.id!==exceptAction&&a.company===company&&['pending','ready'].includes(a.status)).length);
 return result;
}
export function guardNewCompanyCommitment(s:State,command:Command){
 const p=command.payload,type=command.type;
 let company:string|undefined;
 if(['BuyNPCSupply','ExpandWarehouse','StartProduction','ListGoods','PostVacancy','PayDividend','OpenSchool','RegisterHospital','RegisterBank','RegisterInsurer'].includes(type)&&typeof p.companyId==='string')company=p.companyId;
 if(type==='FundOrder'){const quote=s.commerce?.quotes[String(p.quoteId)],listing=quote?s.commerce?.listings[quote.listing]:null;company=listing?.company;}
 if(type==='ReservePayroll')company=s.employment?.contracts[String(p.contractId)]?.company;
 if(type==='ApplyForJob')company=s.employment?.vacancies[String(p.vacancyId)]?.company;
 if(['OfferEmployment','AcceptEmployment'].includes(type)){const application=s.employment?.applications[String(p.applicationId)];company=application?s.employment?.vacancies[application.vacancy]?.company:undefined;}
 if(['DepositSavings','RequestLoan'].includes(type))company=s.finance?.institutions[String(p.providerId)]?.company;
 if(type==='RequestAssessment')company=s.healthcare?.hospitals[String(p.providerId)]?.company;
 if(type==='EnrollCourse')company=s.education?.schools?.[String(p.schoolId)]?.company;
 if(type==='BuyInsurance')company=s.insurance?.providers[String(p.providerId)]?.company;
 if(company&&s.commerce?.companies[company]?.status!=='active')throw new DomainError('COMPANY_COMMITMENTS_PAUSED','This company cannot take new commitments during restructuring or after closure. Existing earned payments and refunds remain available.');
}
