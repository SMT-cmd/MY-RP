/* Selection is immediate; use, placement and storage remain explicit commands. */
window.ObjectUI=(()=>{
 const host=document.createElement('aside');host.id='object-menu';host.hidden=true;host.setAttribute('aria-label','Selected furnishing');host.setAttribute('role','region');document.getElementById('game-stage').append(host);
 let selection=null,context=null,returnFocus=null,progressTick=null;
 const labels={Watch:'Television controls',Sit:'Sit',Rest:'Sleep / rest',Read:'Read',Wash:'Wash hands',Toilet:'Use toilet',Shower:'Take a shower',Clean:'Clean fixture',Dress:'Change outfit',Light:'Lighting controls',RequestFoodAssistance:'Request a meal'};
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function close(restore=false){selection=null;host.hidden=true;host.replaceChildren();clearInterval(progressTick);progressTick=null;if(restore)returnFocus?.focus?.({preventScroll:true});}
 function paint(){
  if(!selection||!context?.view?.world?.home)return close();const {view,send,locked}=context,w=view.world,h=w.home;
  if(selection.homeId!==h.id||selection.leaseVersion!==w.position.leaseVersion)return close();const f=h.fixtures.find(f=>f.id===selection.fixtureId);if(!f)return close();
  host.hidden=false;host.replaceChildren();clearInterval(progressTick);progressTick=null;const title=node('h2',f.name);title.id='object-menu-title';host.setAttribute('aria-labelledby',title.id);host.append(node('p','YOUR SPACE'),title);
  const hint=node('p',f.copy??'Choose how to use or arrange this furnishing.');hint.className='hint';host.append(hint);
  const buttons=node('div');buttons.className='object-actions';host.append(buttons);
  const button=(text,act,disabled=false)=>{const b=node('button',text);b.type='button';b.dataset.gameUi='';b.disabled=!!locked||disabled;b.onclick=act;buttons.append(b);return b;};
  const full=f.use?.capacity>0&&!f.use.availableSlots.length,active=w.homeCare?.active?.fixtureId===f.id?w.homeCare.active:null;
  const use=action=>{const detail={...selection,action};close();window.dispatchEvent(new CustomEvent('home-fixture-use',{detail}));};
  button((f.nearby?'':'Walk over & ')+(labels[f.action]??'Inspect'),()=>use(f.action),f.allowed===false||full||!!active);
  if(active){
   const progress=node('progress');progress.max=1;progress.setAttribute('aria-label','Activity progress');const status=node('p');status.className='hint';status.setAttribute('role','status');host.append(progress,status);
   const finish=button('Finish activity',()=>send('FinishHomeActivity',{sessionId:active.sessionId,leaseVersion:w.position.leaseVersion}));
   button('Stop activity',()=>{close();send('CancelHomeActivity',{sessionId:active.sessionId,leaseVersion:w.position.leaseVersion});});
   const received=performance.now(),serverTime=w.serverTime;
   const tick=()=>{const now=serverTime+performance.now()-received,p=Math.min(1,Math.max(0,(now-active.startedAt)/(active.endsAt-active.startedAt)));progress.value=p;finish.disabled=!!locked||now<active.endsAt;const name=active.kind==='Wash'?(p<.12?'Approaching sink':p<.22?'Turning on tap':p<.58?'Washing with soap':p<.76?'Rinsing hands':p<.91?'Drying hands':'Finishing'):active.kind==='Rest'?(p<.16?'Approaching bed':p<.30?'Lying down':p<.86?'Resting':'Getting up'):active.kind==='Sit'?(p<.15?'Approaching seat':p<.28?'Sitting down':p<.88?'Relaxing':'Standing up'):active.kind==='Toilet'?(p<.25?'Settling onto toilet':p<.79?'Using toilet':p<.90?'Flushing':'Standing up'):active.kind==='Shower'?(p<.20?'Starting shower':p<.62?'Washing':p<.78?'Rinsing':p<.93?'Drying':'Finishing'):active.kind==='Clean'?(p<.12?'Approaching fixture':p<.72?'Scrubbing':p<.84?'Rinsing':p<.94?'Wiping dry':'Finishing'):'Activity in progress';status.textContent=p<1?`${name} · ${Math.max(1,Math.ceil((active.endsAt-now)/1000))}s`:'Activity complete · saving benefit';};
   tick();progressTick=setInterval(tick,250);
  }
  const dirt=w.homeCare?.fixtures?.find(item=>item.fixtureInstanceId===f.instanceId)?.dirt??0;
  if(['sink','vanity','toilet','shower'].includes(f.kind??f.model)){
   host.append(node('p',dirt>=25?'This fixture needs cleaning.':dirt>0?'Lightly used. You can clean it.':'Clean and ready.'));
   if(!h.guest)button((f.nearby?'':'Walk over & ')+'Clean fixture',()=>use('Clean'),full||!!active);
  }
  if(f.allowed===false||full)host.append(node('p',f.allowed===false?'Only the resident can use this.':'All use positions are occupied.'));
  const item=!h.guest&&view.furnishing?.items.find(i=>i.id===f.instanceId),model=item&&view.furnishing.catalogue.find(m=>m.id===item.model);
  if(item&&model){
   button('Move / change finish',()=>{const id=item.id;close();window.GameUI?.open('furnish');window.FurnishingUI?.focusItem(id,true);});
   button('Rotate 90°',()=>{close();send('PlaceFurniture',{furnitureId:item.id,x:item.placement.x,y:item.placement.y,rotation:(item.placement.rotation+90)%360,finish:item.finish,homeVersion:h.version});});
   const essential=item.starter&&['bed','pantry'].includes(item.model);
   button('Put into storage',()=>{close();send('StoreFurniture',{furnitureId:item.id,homeVersion:h.version});},essential);
   if(essential)host.append(node('p','Your starter bed and pantry must stay available.'));
  }
  const dismiss=button('Close',()=>close(true));dismiss.className='secondary';dismiss.disabled=false;
 }
 return{observe(view,send,locked){context={view,send,locked};if(!view?.citizen)return close();if(selection)paint();},open(detail){if(!context?.view?.world?.home)return;window.dispatchEvent(new Event('game-input-release'));window.GameUI?.close(false);selection={...detail};returnFocus=document.activeElement;paint();host.querySelector('button:not(:disabled)')?.focus({preventScroll:true});},close,active:()=>!host.hidden};
})();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&window.ObjectUI.active()){e.preventDefault();window.ObjectUI.close(true);}});
window.addEventListener('game-input-release',()=>window.ObjectUI?.close());
