/* Selection is immediate; use, placement and storage remain explicit commands. */
window.ObjectUI=(()=>{
 const host=document.createElement('aside');host.id='object-menu';host.hidden=true;host.setAttribute('aria-label','Selected furnishing');host.setAttribute('role','region');document.getElementById('game-stage').append(host);
 let selection=null,context=null,returnFocus=null;
 const labels={Sit:'Sit',Rest:'Rest',Read:'Read',Wash:'Wash hands',Dress:'Change outfit',Light:'Lighting controls',RequestFoodAssistance:'Request a meal'};
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function close(restore=false){selection=null;host.hidden=true;host.replaceChildren();if(restore)returnFocus?.focus?.({preventScroll:true});}
 function paint(){
  if(!selection||!context?.view?.world?.home)return close();const {view,send,locked}=context,w=view.world,h=w.home;
  if(selection.homeId!==h.id||selection.leaseVersion!==w.position.leaseVersion)return close();const f=h.fixtures.find(f=>f.id===selection.fixtureId);if(!f)return close();
  host.hidden=false;host.replaceChildren();const title=node('h2',f.name);title.id='object-menu-title';host.setAttribute('aria-labelledby',title.id);host.append(node('p','YOUR SPACE'),title);
  const hint=node('p',f.copy??'Choose how to use or arrange this furnishing.');hint.className='hint';host.append(hint);
  const buttons=node('div');buttons.className='object-actions';host.append(buttons);
  const button=(text,act,disabled=false)=>{const b=node('button',text);b.type='button';b.dataset.gameUi='';b.disabled=!!locked||disabled;b.onclick=act;buttons.append(b);return b;};
  const full=f.use?.capacity>0&&!f.use.availableSlots.length;
  button((f.nearby?'':'Walk over & ')+(labels[f.action]??'Inspect'),()=>{const detail={...selection};close();window.dispatchEvent(new CustomEvent('home-fixture-use',{detail}));},f.allowed===false||full);
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
