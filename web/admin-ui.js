window.AdminUI=(()=>{
 const $=id=>document.getElementById(id);
 let context=null,actor=null,generation=0,busy=false,access=null,view=null,factors=[],setup=null,pending=null,timer=null;
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const date=value=>value===null?'No expiry':new Date(value).toLocaleString();
 const message=(text,error=false)=>{const e=$('staff-status');e.textContent=text;e.classList.toggle('error',error);};
 function button(text,callback,id){const b=node('button',text);b.type='button';if(id)b.id=id;b.disabled=busy; b.addEventListener('click',()=>void callback());return b;}
 function field(form,label,id,type='text'){const l=node('label',label);l.htmlFor=id;const input=node(type==='select'?'select':'input');input.id=id;if(type!=='select')input.type=type;form.append(l,input);return input;}
 function reasonField(form,id){const input=field(form,'Reason for this change or review',id);input.required=true;input.minLength=10;input.maxLength=400;return input;}
 function clearSecrets(){setup=null;const e=$('staff-secret');if(e)e.textContent='';const code=$('staff-code');if(code)code.value='';}
 function reset(){generation++;clearTimeout(timer);timer=null;context=null;actor=null;busy=false;access=null;view=null;factors=[];clearSecrets();$('staff-panel').hidden=true;$('staff-controls').replaceChildren();$('staff-mfa').replaceChildren();message('');}
 function lock(){document.querySelectorAll('#staff-controls button,#staff-controls input,#staff-controls select').forEach(e=>e.disabled=busy||!!pending);document.querySelectorAll('#staff-mfa button,#staff-mfa input,#staff-mfa select').forEach(e=>e.disabled=busy);if($('staff-retry'))$('staff-retry').disabled=busy||pending?.actor!==actor;if($('staff-step-up'))$('staff-step-up').disabled=busy;}
 async function work(callback){if(busy||!context)return;busy=true;const stamp=generation;lock();try{await callback(stamp);}catch(error){if(stamp===generation)message(error.message,true);}finally{if(stamp===generation){busy=false;lock();}}}
 async function load(stamp){
  const result=await context.request('/api/admin/access');if(stamp!==generation)return;access=result;view=null;
  $('staff-panel').hidden=!access.available&&pending?.actor!==actor;
  if(pending?.actor===actor&&!access.stepUpRequired){const settled=await context.request('/api/admin/receipt?id='+encodeURIComponent(pending.command.id));if(stamp!==generation)return;if(settled.receipt){pending=null;message('Your original staff action was confirmed.');}}
  if(!access.available&&pending?.actor!==actor){clearSecrets();$('staff-controls').replaceChildren();$('staff-mfa').replaceChildren();return;}
  if(access.stepUpRequired){clearSecrets();$('staff-controls').replaceChildren();message('Verify an authenticator code to open your staff controls.');await loadFactors(stamp);}
  else if(access.available){const next=await context.request('/api/admin/view');if(stamp!==generation)return;view=next;clearSecrets();$('staff-mfa').replaceChildren();draw();scheduleExpiry();}
  else{message('This account no longer has staff authority. Your action is unconfirmed; refresh after an operator reviews it.');$('staff-controls').replaceChildren(button('Refresh action status',()=>work(load),'staff-refresh'));$('staff-mfa').replaceChildren();}
 }
 function scheduleExpiry(){clearTimeout(timer);const stamp=generation;timer=setTimeout(()=>{if(stamp!==generation)return;view=null;clearSecrets();$('staff-controls').replaceChildren();message('Staff verification expired. Verify a fresh code before continuing.');void work(load);},Math.max(0,view.stepUpUntil-view.serverTime));}
 async function loadFactors(stamp){const result=await context.request('/api/mfa/list',{});if(stamp!==generation)return;factors=result.factors;drawMFA();}
 function drawMFA(){
  const host=$('staff-mfa');host.replaceChildren(node('h3','Authenticator verification'),node('p','Use a TOTP authenticator app. Its setup key and your code are held only in this page and cleared when you leave staff controls.'));
  if(setup){host.append(node('p','Add an account named MY-RP in your authenticator app using this setup key.'));const secret=node('code',setup.secret);secret.id='staff-secret';host.append(secret);}
  if(factors.length){const form=node('form');form.id='staff-mfa-form';const select=field(form,'Your authenticator','staff-factor','select');for(const factor of factors){const o=node('option',(factor.friendly_name||'Authenticator')+' · '+factor.status);o.value=factor.id;select.append(o);}if(setup)select.value=setup.factorId;
   const code=field(form,'Current six-digit code','staff-code');code.required=true;code.pattern='[0-9]{6}';code.inputMode='numeric';code.autocomplete='one-time-code';code.maxLength=6;
   const verify=node('button','Verify code');verify.type='submit';verify.id='staff-verify';form.append(verify);form.addEventListener('submit',event=>{event.preventDefault();const value=code.value,factorId=select.value;code.value='';void work(async stamp=>{
    const challenge=await context.request('/api/mfa/challenge',{factorId});if(stamp!==generation)return;const result=await context.request('/api/mfa/verify',{factorId,challengeId:challenge.challengeId,code:value});if(stamp!==generation)return;clearSecrets();context.acceptSession(result);message('Authenticator verified.');await load(stamp);
   });});host.append(form);
   for(const factor of factors.filter(f=>f.status==='unverified'))host.append(button('Discard unfinished setup · '+factor.id,()=>work(async stamp=>{await context.request('/api/mfa/discard',{factorId:factor.id});if(stamp!==generation)return;clearSecrets();await loadFactors(stamp);}), 'staff-discard-'+factor.id));
  }
  host.append(button('Set up an authenticator',()=>work(async stamp=>{const result=await context.request('/api/mfa/enroll',{});if(stamp!==generation)return;setup=result;await loadFactors(stamp);}), 'staff-enroll'));
  if(pending?.actor===actor)host.append(node('p','Your unconfirmed staff action is still held for retry after verification.'));
 }
 function draft(type,payload){if(busy||pending||!view)return;pending={actor,command:{id:crypto.randomUUID(),accountId:actor,type,payload:{adminVersion:view.adminVersion,...payload}}};void send();}
 async function send(){if(!pending||pending.actor!==actor)return;await work(async stamp=>{
  try{const settled=await context.request('/api/admin/receipt?id='+encodeURIComponent(pending.command.id));if(stamp!==generation)return;const result=settled.receipt?{receipt:settled.receipt,replayed:true}:await context.request('/api/admin/commands',pending.command);if(stamp!==generation)return;pending=null;access=result.access;view=result.view;
   message(result.replayed?'The original staff action was confirmed.':result.receipt.detail.message);if(view){draw();scheduleExpiry();}else await load(stamp);
  }catch(error){if(stamp!==generation)return;
   if(error.confirmed){pending=null;await load(stamp);message(error.message,true);}else{message(error.message+' The original action identifier is held for retry. Keep this tab open.',true);if(view)draw();}
  }
 });}
 function draw(){
  const host=$('staff-controls');host.replaceChildren();if(!view)return;
  host.append(node('p',view.notice),node('p','Your authority: '+view.yourGrants.map(g=>g.role+' / '+(g.region||'world')+' / '+date(g.expiresAt)).join('; ')));
  host.append(button('Refresh staff records',()=>work(load),'staff-refresh'),button('Verify a fresh authenticator code',()=>work(async stamp=>{view=null;host.replaceChildren();await loadFactors(stamp);}), 'staff-step-up'));
  if(pending){host.append(node('p',pending.actor===actor?'A staff action has not been confirmed. Retry its original identifier.':'Another account has an unconfirmed staff action in this tab. Sign back into that account to resolve it.'),button('Retry staff action',send,'staff-retry'));}
  if(view.canManageStaff){
   const form=node('form');form.id='staff-grant-form';form.append(node('h3','Propose a bounded staff grant'),node('p','Another staff-grant authority must independently approve these exact terms. The grant changes no player assets or office.'));
   const target=field(form,'Verified Auth account ID','staff-target');target.required=true;target.pattern='[a-fA-F0-9-]{36}';
   const role=field(form,'Role','staff-role','select');for(const r of view.staffRoles){const o=node('option',r);o.value=r;role.append(o);}
   const region=field(form,'Jurisdiction','staff-region','select');const all=node('option','Whole world');all.value='';region.append(all);for(const r of view.regions){const o=node('option',r);o.value=r;region.append(o);}
   const days=field(form,'Expires after days (1–30)','staff-days','number');days.min=1;days.max=30;days.step=1;days.value=1;days.required=true;
   const reason=reasonField(form,'staff-grant-reason'),submit=node('button','Review exact grant');submit.type='submit';form.append(submit);
   form.addEventListener('submit',event=>{event.preventDefault();if(pending||busy)return;const payload={action:'grant',targetActorId:target.value.trim(),role:role.value,region:region.value||null,grantUntil:view.serverTime+Number(days.value)*86400000,reason:reason.value.trim()};if(!window.confirm('Grant '+payload.role+' in '+(payload.region||'whole world')+' to '+payload.targetActorId+' until '+date(payload.grantUntil)+'? Two distinct approvals are required.'))return;draft('ProposeStaffChange',payload);});host.append(form);
   const grants=node('div');grants.append(node('h3','Recorded grants'));
   for(const g of view.grants){const row=node('article');row.append(node('p',g.actor+' · '+g.role+' · '+(g.region||'world')+' · '+g.status+' · '+date(g.expiresAt)));
    if(g.status==='active'&&(g.expiresAt===null||g.expiresAt>view.serverTime)){const f=node('form'),why=reasonField(f,'revoke-reason-'+g.id),b=node('button','Propose revocation');b.type='submit';f.append(b);f.addEventListener('submit',e=>{e.preventDefault();draft('ProposeStaffChange',{action:'revoke',grantId:g.id,grantVersion:g.version,reason:why.value.trim()});});row.append(f);}grants.append(row);
   }host.append(grants);
   const proposals=node('div');proposals.id='staff-proposals';proposals.append(node('h3','Independent reviews'));
   for(const p of view.proposals){const row=node('article');row.append(node('h4',p.action+' '+p.role+' · '+p.status+(p.expired?' · expired':'')),node('p','Account '+p.target+' · jurisdiction '+(p.region||'world')+' · grant ends '+date(p.grantUntil)+' · review ends '+date(p.expiresAt)),node('p',p.reason),node('p','Exact terms: '+p.signature),node('p','Approvals: '+p.approvals.map(a=>a.actor+' at '+date(a.at)+' — '+a.reason).join('; ')));
    const payload={proposalId:p.id,proposalVersion:p.version,signature:p.signature};
    if(!p.expired&&['pending','ready'].includes(p.status)&&p.canDecide){const f=node('form'),reason=reasonField(f,'staff-review-'+p.id);for(const [approve,label] of [[true,'Approve exact terms'],[false,'Reject proposal']]){const b=node('button',label);b.type='submit';b.value=String(approve);f.append(b);}f.addEventListener('submit',e=>{e.preventDefault();draft('DecideStaffChange',{...payload,approve:e.submitter.value==='true',reason:reason.value.trim()});});row.append(f);}
    if(!p.expired&&p.status==='ready'&&p.validApprovals>=2)row.append(button('Apply approved staff change',()=>draft('ApplyStaffChange',payload),'staff-apply-'+p.id));proposals.append(row);
   }host.append(proposals);
  }
  if(view.availability){host.append(node('h3','World availability'));for(const [name,value] of Object.entries(view.availability))host.append(node('p',name+': '+value));}
  if(view.economy.length){host.append(node('h3','Authorised treasury diagnostics'));for(const row of view.economy)host.append(node('p',row.region+' · treasury ₦'+(row.treasury/100).toFixed(2)+' · '+row.citizens+' citizens'));}
  const audit=node('details');audit.append(node('summary','Restricted staff audit · last 100 authorised records'));for(const record of view.audit)audit.append(node('p',record.sequence+' · '+date(record.at)+' · '+record.actor+' · '+record.action+' · '+record.target+' · '+record.reason+' · '+record.hash));host.append(audit);lock();
 }
 function observe(next){if(!next){if(context)reset();return;}if(actor===next.actor){context=next;return;}reset();context=next;actor=next.actor;void work(load);}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;busy=false;clearSecrets();view=null;factors=[];clearTimeout(timer);$('staff-controls').replaceChildren();$('staff-mfa').replaceChildren();message('Staff controls paused. Refresh and verify when you return.');}else if(context)void work(load);});
 return{observe,reset};
})();
