'use strict';
window.HomeVisitsUI=(()=>{
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 function render(view,send,busy){
  const panel=document.getElementById('home-visits-panel'),root=document.getElementById('home-visits-records'),data=view.homeVisits;panel.hidden=!data;if(!data)return;root.replaceChildren();
  const button=(parent,label,type,payload,disabled=false)=>{const b=el('button',label);b.type='button';b.disabled=busy||disabled;b.onclick=()=>send(type,payload);parent.append(b);return b;};
  root.append(el('p',data.terms));
  if(data.canInvite){
   const form=el('form'),target=el('input'),duration=el('select'),consent=el('input'),submit=el('button','Send home invitation');
   const label=(text,input)=>{const l=el('label',text);l.append(input);form.append(l);};target.name='citizenId';target.required=true;target.maxLength=80;target.setAttribute('aria-label','Guest citizen ID');label('Guest citizen ID',target);
   for(const minutes of data.rules.durations){const option=el('option',minutes+' minutes');option.value=minutes;duration.append(option);}duration.name='durationMinutes';label('Visit duration from now',duration);
   consent.type='checkbox';consent.required=true;consent.name='consent';label('I accept these visit permissions and withdrawal terms',consent);
   submit.type='submit';submit.disabled=busy;form.append(submit);form.onsubmit=e=>{e.preventDefault();if(!consent.checked)return;send('InviteHomeVisit',{citizenId:target.value.trim(),durationMinutes:Number(duration.value),termsVersion:data.rules.version,acceptTerms:true,homeVersion:view.world.home.version,leaseVersion:view.world.position.leaseVersion});};root.append(form);
  }else root.append(el('p','Enter your current home to invite a guest. You can review, decline or end an existing visit wherever you are.'));
  for(const visit of data.visits){
   const card=el('article'),host=visit.hostId===view.citizen.id,recipient=host?visit.guestName:visit.hostName;
   card.append(el('h3',host?'Guest: '+recipient:'Invitation from '+recipient),el('p',visit.region+' · '+visit.address+' · '+visit.status+' · access ends '+new Date(visit.expiresAt).toLocaleString()));
   const reference={visitId:visit.id,visitVersion:visit.version};
   if(visit.status==='invited'&&!host){
    const form=el('form'),label=el('label','I accept this home, expiry and the displayed guest permissions'),check=el('input'),submit=el('button','Accept home visit');check.type='checkbox';check.required=true;label.append(check);submit.type='submit';submit.disabled=busy;form.append(label,submit);
    form.onsubmit=e=>{e.preventDefault();if(check.checked)send('AcceptHomeVisit',{...reference,homeId:visit.homeId,acceptedExpiresAt:visit.expiresAt,termsVersion:visit.termsVersion,acceptTerms:true});};card.append(form);button(card,'Decline home visit','DeclineHomeVisit',reference);
   }
   if(host&&['invited','accepted'].includes(visit.status))button(card,'Withdraw home visit','WithdrawHomeVisit',reference);
   if(!host&&visit.status==='accepted'){
    button(card,'End home visit','EndHomeVisit',reference);
    if(visit.entrance&&visit.region===view.world.position.region&&view.world.position.interior===null&&!view.world.trip){const b=el('button','Walk to invited home');b.type='button';b.disabled=busy;b.onclick=()=>window.dispatchEvent(new CustomEvent('building-select',{detail:{buildingId:visit.entrance.id,leaseVersion:view.world.position.leaseVersion}}));card.append(b);}
    else if(visit.region!==view.world.position.region)card.append(el('p','Travel to '+visit.region+' before walking to this home.'));
   }
   if(visit.closeReason)card.append(el('p','Visit ended: '+visit.closeReason.replaceAll('-',' ')+'.'));
   root.append(card);
  }
 }
 return{render};
})();
