'use strict';
window.HealthcareUI=(()=>{
 const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(n/100);
 let view,send,locked;
 function card(title,text){const box=document.createElement('article');box.className='course-record';const h=document.createElement('h3'),p=document.createElement('p');h.textContent=title;p.textContent=text;box.append(h,p);$('healthcare-records').append(box);return box;}
 function action(box,label,type,payload,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=locked||disabled;b.addEventListener('click',()=>send(type,payload));box.append(b);}
 function render(next,dispatch,busy){view=next;send=dispatch;locked=busy;const m=view.healthcare;$('healthcare-panel').hidden=!m;if(!m)return;$('healthcare-records').replaceChildren();const cid=view.citizen.id,active=m.cases.find(c=>c.patient===cid&&!['completed','cancelled'].includes(c.status)),govern=new Set(view.commerce.companies.filter(c=>['founder','cofounder','ceo'].includes(c.role)).map(c=>c.id));
  m.providers.forEach(p=>action(card(p.name,`Assessment ${money(p.consultation)}. Treatment needs separate consent: current quote ${money(p.treatment)}. Only this game-health episode is shared with qualified treating staff.`),'Consent to scoped assessment','RequestAssessment',{providerId:p.id,acceptedConsultation:p.consultation,consent:true},!!active||!!view.world.trip));
  view.commerce.companies.filter(c=>c.sector==='healthcare'&&govern.has(c.id)&&!m.hospitals.some(h=>h.company===c.id)).forEach(c=>action(card(c.name,'Hospital registration requires current clinical qualifications, an operating budget, actual medicine, power and available staff.'),'Register qualified hospital','RegisterHospital',{companyId:c.id}));
  m.hospitals.forEach(h=>{const box=card(view.commerce.companies.find(c=>c.id===h.company)?.name??'Hospital',`${h.active?'Open':'Intake closed'} · ${h.region} · ${h.beds} slots · quality ${h.quality}/100. Buy medicine and power into the company inventory to deliver care.`);if(h.active&&govern.has(h.company))action(box,'Close new intake; preserve patient continuity','CloseHospital',{hospitalId:h.id});});
  m.cases.forEach(c=>{const mine=c.patient===cid,box=card(c.patientName+' · '+c.status,`${c.condition?'Game condition: '+c.condition+'. ':''}Recorded health ${c.intake.health}/100 and energy ${c.intake.energy}/100. ${c.referral?'Referral: '+c.referral+'. ':''}${c.recoveryAt?'Recovery completes '+new Date(c.recoveryAt).toLocaleTimeString()+'.':''}`);
   if(c.status==='queued'&&c.canTreat)action(box,'Use approved game assessment','AssessPatient',{caseId:c.id,choice:0},view.serverTime<c.createdAt+2000);
   if(mine&&c.status==='assessed'&&!c.transport){action(box,'Accept treatment terms and reserve '+money(c.quote),'AcceptTreatment',{caseId:c.id,acceptedFee:c.quote,acceptTerms:true});if(c.condition==='urgent')action(box,'Request free regional emergency transport','RequestEmergencyTransport',{caseId:c.id});}
   if(c.status==='funded'&&c.canTreat)action(box,'Verify procedure and commit supplies','TreatPatient',{caseId:c.id,choice:0});
   if(c.status==='recovering')action(box,'Record completed recovery and settle care','CompleteRecovery',{caseId:c.id},view.serverTime<c.recoveryAt);
   if(mine&&['queued','assessed','funded'].includes(c.status)&&!c.transport){action(box,'Cancel unearned care and recover funds','CancelHealthcare',{caseId:c.id});if(c.provider!=='npc')action(box,'Transfer to NPC cover and return unused fees','TransferCareToNPC',{caseId:c.id});}
  });
 }
 return{render};
})();
