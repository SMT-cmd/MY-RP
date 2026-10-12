(() => {
 let latest=null,dispatch=null,locked=true,owner=null,form=null;const cards=new Map();
 const element=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 function render(view,perform,disabled){
  const host=document.getElementById('civic-panel');if(!host)return;latest=view;dispatch=perform;locked=disabled;
  if(!view?.civic||owner!==view.accountId){host.replaceChildren();cards.clear();form=null;owner=view?.accountId??null;}
  host.hidden=!view?.civic;if(!view?.civic)return;const civic=view.civic;
  if(!form){
   host.append(element('h2','Civic petitions · '+civic.region),element('p',civic.notice),element('p',civic.limits.threshold+' supporters; '+civic.limits.windowDays+'-day support window; consideration available '+civic.limits.reviewDelayDays+' day after notice. One proposal per '+civic.limits.proposalIntervalDays+' day and '+civic.limits.supportChanges+' support changes per person, including initial support. Estimated costs are preliminary virtual-naira budget checks.'));
   const root=element('form'),label=element('label','Public-service subject'),select=element('select');select.id='civic-topic';label.htmlFor=select.id;
   for(const t of civic.topics){const o=element('option',t.name);o.value=t.id;select.append(o);}label.append(select);
   const agree=element('label'),consent=element('input');consent.type='checkbox';consent.id='civic-consent';agree.className='check';agree.append(consent,element('span','I agree to publish this proposal under my citizen name and add my private support.'));
   const button=element('button','Publish petition');button.type='submit';root.append(label,agree,button);host.append(root);form={root,select,consent,button};
   root.addEventListener('submit',event=>{event.preventDefault();if(locked||!consent.checked)return;dispatch('CreateCivicPetition',{topic:select.value,termsVersion:latest.civic.termsVersion,consent:true});consent.checked=false;});
  }
  form.select.disabled=form.consent.disabled=form.button.disabled=locked;
  const visible=new Set();
  for(const p of civic.petitions){
   visible.add(p.id);let card=cards.get(p.id);
   if(!card){
    const root=element('article'),heading=element('h3'),status=element('p'),review=element('p'),agree=element('label'),consent=element('input'),support=element('button','Record support'),withdraw=element('button','Withdraw my support'),end=element('button','Withdraw my petition'),consider=element('button','Request NPC consideration');
    consent.type='checkbox';agree.className='check';agree.append(consent,element('span','I have reviewed this subject and consent to record my private support.'));for(const b of [support,withdraw,end,consider])b.type='button';
    root.dataset.petitionId=p.id;root.append(heading,status,review,agree,support,withdraw,end,consider);host.append(root);card={root,heading,status,review,agree,consent,support,withdraw,end,consider};cards.set(p.id,card);
    const act=(type,checkConsent=false)=>{const current=latest?.civic?.petitions.find(v=>v.id===p.id);if(locked||!current||checkConsent&&!consent.checked)return;dispatch(type,{petitionId:current.id,petitionVersion:current.version,termsVersion:current.termsVersion,...(checkConsent?{consent:true}:{})});consent.checked=false;};
    support.addEventListener('click',()=>act('SupportCivicPetition',true));withdraw.addEventListener('click',()=>act('WithdrawCivicSupport'));end.addEventListener('click',()=>act('WithdrawCivicPetition'));consider.addEventListener('click',()=>act('ReviewCivicPetition'));
   }
   card.heading.textContent=p.subject+' · proposed by '+p.author;
   card.status.textContent=p.supportCount+'/'+p.threshold+' supporters · '+p.status+' · support closes '+new Date(p.deadline).toLocaleString()+'. '+(p.notice?'Formal notice recorded.':'No formal notice yet.');
   const outcomes={'withdrawn':'The proposer withdrew this request.','insufficient-support':'Current support is below the threshold.','funding-proposal-required':'The recorded treasury cannot cover the preliminary estimate; a funding proposal is required.','formal-budget-review-required':'The request needs formal budget and policy review before any commitment.'};
   card.review.textContent=p.review?outcomes[p.review.outcome]+' Recorded support: '+p.review.support+'. No funds were spent.':p.notice?'NPC consideration available from '+new Date(p.notice.reviewAt).toLocaleString()+'. This desk cannot pass a law or approve expenditure.':'';
   card.agree.hidden=card.support.hidden=!p.canSupport;card.withdraw.hidden=!p.canWithdrawSupport;card.end.hidden=!p.canProposeWithdrawal;card.consider.hidden=!p.notice||!!p.review;
   card.consent.disabled=card.support.disabled=card.withdraw.disabled=card.end.disabled=locked;card.consider.disabled=locked||!p.canReview;
  }
  for(const [id,card] of cards)if(!visible.has(id)){card.root.remove();cards.delete(id);}
 }
 window.CivicUI={render};
})();
