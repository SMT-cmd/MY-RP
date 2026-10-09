/* Private consent controls. The server decides relationship and home authority. */
window.RelationshipsUI=(()=>{
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 function render(view,perform,busy){
  const panel=document.getElementById('relationships-panel'),root=document.getElementById('relationships-records'),data=view?.relationships;
  if(!panel)return;panel.hidden=!data;root.replaceChildren();if(!data)return;
  root.append(el('p',data.terms),el('p',data.accepting?'Relationship requests are enabled.':'Relationship requests are off. Enable them in Your privacy to receive requests.'));
  const form=el('form');form.dataset.action='invite';const label=el('label','Citizen reference'),input=el('input');input.name='citizenId';input.required=true;input.maxLength=80;label.append(input);form.append(label);
  const type=el('select');type.name='kind';for(const [value,text] of [['friend','Friendship'],['partner','Partnership']]){const option=el('option',text);option.value=value;type.append(option);}const typeLabel=el('label','Request type');typeLabel.append(type);form.append(typeLabel);
  const consent=el('input');consent.type='checkbox';consent.name='consent';consent.required=true;const consentLabel=el('label','I have reviewed the relationship terms.');consentLabel.prepend(consent);consentLabel.className='check';form.append(consentLabel);
  const send=el('button','Send relationship request');send.type='submit';send.disabled=busy;form.append(send);form.onsubmit=e=>{e.preventDefault();if(!form.reportValidity())return;perform('InviteRelationship',{citizenId:input.value.trim(),kind:type.value,termsVersion:data.rules.version,acceptTerms:consent.checked});};root.append(form);
  for(const r of data.records){
   const card=el('article');card.className='record-card';card.dataset.relationshipId=r.id;card.append(el('h3',r.other.name+' · '+(r.kind==='friend'?'Friendship':'Partnership')),el('p',r.other.id),el('p','Status: '+r.status+'.'));
   const payload={relationshipId:r.id,relationshipVersion:r.version};
   const action=(label,type)=>{const b=el('button',label);b.type='button';b.disabled=busy;b.onclick=()=>perform(type,payload);card.append(b);};
   if(r.status==='invited'){
    card.append(el('p','Request expires '+new Date(r.expiresAt).toLocaleString()+'.'));
    if(r.incoming){const accept=el('form'),box=el('input');accept.dataset.action='accept';box.type='checkbox';box.name='consent';box.required=true;const label=el('label','I accept this '+(r.kind==='friend'?'friendship':'partnership')+' with '+r.other.name+'.');label.prepend(box);label.className='check';accept.append(label);const b=el('button','Accept relationship');b.disabled=busy;b.type='submit';accept.append(b);accept.onsubmit=e=>{e.preventDefault();if(!accept.reportValidity())return;perform('AcceptRelationship',{...payload,kind:r.kind,senderCitizenId:r.other.id,acceptedExpiresAt:r.expiresAt,termsVersion:r.termsVersion,acceptTerms:box.checked});};card.append(accept);action('Decline request','DeclineRelationship');}
    else action('Withdraw request','WithdrawRelationship');
   }
   if(r.status==='active'){
    action('End relationship','EndRelationship');
    const ownHome=view.world?.home;
    if(ownHome&&!ownHome.guest&&view.homeVisits){const invite=el('form');invite.dataset.action='home-invite';const box=el('input');box.type='checkbox';box.name='consent';box.required=true;const label=el('label','I have reviewed the home visit terms.');label.prepend(box);label.className='check';invite.append(el('p',view.homeVisits.terms),label);const b=el('button','Invite for a 15-minute home visit');b.type='submit';b.disabled=busy;invite.append(b);invite.onsubmit=e=>{e.preventDefault();if(!invite.reportValidity())return;perform('InviteHomeVisit',{citizenId:r.other.id,homeVersion:ownHome.version,leaseVersion:view.world.position.leaseVersion,durationMinutes:15,termsVersion:view.homeVisits.rules.version,acceptTerms:box.checked});};card.append(invite);}
   }
   if(r.closeReason)card.append(el('p','Ended: '+r.closeReason+'.'));
   if(r.status!=='ended'){const block=el('button','Block citizen');block.type='button';block.disabled=busy;block.onclick=()=>perform('BlockCitizen',{citizenId:r.other.id});card.append(block);}
   root.append(card);
  }
 }
 return{render};
})();
