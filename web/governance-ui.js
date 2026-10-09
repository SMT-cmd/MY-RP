'use strict';
window.GovernanceUI=(()=>{
 const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(n/100);
 let view,send,busy=false;
 const paragraph=text=>{const p=document.createElement('p');p.textContent=text;return p;};
 function button(box,label,type,payload,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=busy||disabled;b.addEventListener('click',()=>send(type,payload));box.append(b);}
 function render(next,dispatch,locked){
  view=next;send=dispatch;busy=locked;const m=view.governance;$('governance-panel').hidden=!m;if(!m)return;
  const select=$('governance-company'),previous=select.value;select.replaceChildren();
  for(const c of m.companies){const option=document.createElement('option');option.value=c.id;option.textContent=`${c.name} · ${c.yourShares}/${c.issuedShares} shares · ${c.availableShares} available`;select.append(option);}
  if([...select.options].some(o=>o.value===previous))select.value=previous;
  $('governance-company-state').replaceChildren();
  for(const c of m.companies){const box=document.createElement('article');box.className='course-record';box.append(paragraph(`${c.name} · ${c.status} · available cash ${money(c.balance)} · ${c.requiredApprovals} controller signature(s).`));box.append(paragraph(c.closureBlockers.length?'Before closure: '+c.closureBlockers.map(b=>`${b.kind}: ${b.count}`).join('; '):'No recorded unresolved assets or commitments. A final distribution still needs every shareholder and the required controllers.'));$('governance-company-state').append(box);}
  $('governance-create').hidden=!m.companies.length;$('governance-records').replaceChildren();
  for(const a of m.actions){
   const box=document.createElement('article');box.className='course-record';const heading=document.createElement('h3');heading.textContent=`${a.kind} · ${a.status}`;box.append(heading);
   const approvals=a.controllers.filter(id=>a.votes[id]===true).length,consents=a.owners.filter(id=>a.consents[id]===true).length;
   box.append(paragraph(`Company ${a.company} · ${money(a.amount)} · ${a.units} share units. Controller signatures ${approvals}/${a.required}. Ownership consents ${consents}/${a.owners.length}. Expires ${new Date(a.expiresAt).toLocaleString()}.`));
   if(a.buyer)box.append(paragraph(`Buyer ${a.buyer} · purchase terms ${a.buyerAccepted?'accepted and funds reserved':'awaiting acceptance'}.`));
   if(a.holder)box.append(paragraph(`Existing holder ${a.holder}. A share deal transfers ownership only; it does not grant management duties or personal assets.`));
   if(a.kind==='issue')box.append(paragraph('New shares dilute existing percentages. Every current shareholder must consent before any share is issued.'));
   if(a.kind==='restructure')box.append(paragraph('New purchases, production, adverts, deposits, loans and intake will pause. Existing funded work, deliveries, refunds, care and principal withdrawals remain available.'));
   if(a.kind==='liquidate')box.append(paragraph('Closure cannot erase worker pay, customer reserves, stock, student care, deposits, loans or insurance commitments. All must be resolved first; remaining cash goes to the recorded owners.'));
   $('governance-records').append(box);
   if(!['pending','ready'].includes(a.status))continue;
   if(a.expired){button(box,'Return expired funds and release shares','ExpireCorporateAction',{proposalId:a.id});continue;}
   if(a.stale)box.append(paragraph('Ownership or controllers changed. This proposal cannot settle; cancel and review fresh terms.'));
   if(a.canCancel)button(box,'Cancel and refund uncommitted reservations','CancelCorporateAction',{proposalId:a.id});
   if(a.stale)continue;
   if(a.canVote){button(box,'Sign approval for these exact terms','VoteCorporateAction',{proposalId:a.id,signature:a.signature,approve:true});button(box,'Reject or withdraw my approval','VoteCorporateAction',{proposalId:a.id,signature:a.signature,approve:false});}
   if(a.canConsent)button(box,'Accept ownership terms and reserve any purchase price','AcceptCorporateTerms',{proposalId:a.id,signature:a.signature,acceptedAmount:a.amount,acceptedUnits:a.units,acceptTerms:true});
   button(box,'Settle approved funds and shares once','ExecuteCorporateAction',{proposalId:a.id},a.status!=='ready');
  }
  for(const control of $('governance-create').querySelectorAll('input,select,button'))control.disabled=busy;
 }
 $('governance-create').addEventListener('submit',event=>{
  event.preventDefault();const companyId=$('governance-company').value,kind=$('governance-kind').value,amount=Math.round(Number($('governance-amount').value)*100),units=Number($('governance-units').value),citizenId=$('governance-citizen').value.trim();
  const shareAction=['transfer','issue','buyback'].includes(kind);
  if(confirm(`Review ${kind}: ${money(amount)}${shareAction?`, ${units} share units, citizen ${citizenId}`:''}. Reservations expire after seven days. Closure requires all obligations resolved and every shareholder's consent.`))send('ProposeCorporateAction',{companyId,kind,amount,acceptTerms:true,...(shareAction?{units}:{}),...(['transfer','issue'].includes(kind)?{buyerCitizenId:citizenId}:kind==='buyback'?{holderCitizenId:citizenId}:{})});
 });
 return{render};
})();
