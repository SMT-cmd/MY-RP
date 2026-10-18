// Physical counters reuse the authoritative economy, employment and ledger.
(()=>{
 const host=document.createElement('aside');host.id='venue-menu';host.hidden=true;host.setAttribute('aria-label','Selected counter');host.setAttribute('role','region');document.getElementById('game-stage').append(host);
 let context=null,selection=null,timer=null;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function close(){host.hidden=true;selection=null;host.replaceChildren();clearInterval(timer);timer=null;}
 function paint(){
  if(!context||!selection)return;const {view,send,locked,walk}=context,w=view.world,v=w?.venue,f=v?.fixtures.find(f=>f.id===selection.fixtureId);if(!f||selection.venueId!==v.id||selection.leaseVersion!==w.position.leaseVersion){close();return;}
  host.hidden=false;host.replaceChildren();host.append(node('h3',f.name));const button=(label,type,payload={},disabled=false)=>{const b=node('button',label);b.type='button';b.dataset.gameUi='';b.disabled=locked||disabled;b.onclick=()=>{close();walk(w,window.Walking.approach(w,f),{type,payload});};host.append(b);return b;};
  const dismiss=node('button','Close counter');dismiss.type='button';dismiss.onclick=close;host.append(dismiss);
  if(f.action==='shop'){
   host.append(node('p','Review the exact virtual price. Collect paid orders at the pickup counter, then carry them home for placement.'));
   const models=v.catalogue.filter(m=>!f.category||m.category===f.category),select=node('select');select.setAttribute('aria-label','Furniture to buy');for(const m of models){const o=node('option',m.name+' · ₦'+(m.price/100).toLocaleString('en-NG'));o.value=m.id;select.append(o);}host.append(select);const finish=node('select');finish.setAttribute('aria-label','Furniture finish');for(const value of v.finishes){const o=node('option',value);o.value=value;finish.append(o);}host.append(finish);
   const buy=button('Review and buy selected furniture','BuyShowroomFurniture');buy.onclick=()=>{const m=models.find(m=>m.id===select.value);if(!m)return;const payload={fixtureId:f.id,modelId:m.id,acceptedPrice:m.price,finish:finish.value,acceptTerms:true};close();walk(w,window.Walking.approach(w,f),{type:'BuyShowroomFurniture',payload});};
  }else if(f.action==='pickup'){
   const orders=v.orders.filter(o=>o.collectedAt===null);if(!orders.length)host.append(node('p','No orders are waiting for collection.'));for(const o of orders)button('Collect '+o.modelId,'CollectShowroomFurniture',{orderId:o.id});
  }else if(f.action==='work-start'){
   const active=v.activeWork;if(!active)for(const job of v.jobs)button('Start '+job.name+' · ₦'+(job.wage/100),'BeginVenueWork',{jobId:job.id});
   else{host.append(node('p',`${active.completedTasks} of 3 workstations complete. Wage settlement opens after the reserved shift interval.`));button('Settle completed physical shift','CompleteVenueWork',{},!active.ready);}
  }else if(f.action==='work-task'){
   const active=v.activeWork,task=active?.task;if(!active)host.append(node('p','Visit the supervisor to reserve a funded shift first.'));
   else if(task?.fixtureId===f.id){host.append(node('p','Stay beside this workstation while the task runs.'));const finish=button('Complete workstation task','CompleteVenueTask',{taskId:task.id},w.serverTime<task.readyAt),start=performance.now();clearInterval(timer);timer=setInterval(()=>{finish.disabled=locked||w.serverTime+performance.now()-start<task.readyAt;},200);}
   else button('Begin workstation task','BeginVenueTask',{},f.id!=='work-'+active.completedTasks);
  }else{
   const destination={school:'learn',market:'business',clinic:'health',terminal:'travel'}[f.action];if(destination){const b=node('button','Open '+f.name);b.type='button';b.onclick=()=>{close();window.GameUI.open(destination);};host.append(b);}else host.append(node('p',f.copy??'Inspect this counter.'));
  }
 }
 window.addEventListener('venue-fixture-select',e=>{selection=e.detail;window.dispatchEvent(new Event('game-input-release'));paint();});
 window.VenueUI={handles:id=>['school','work','market','clinic','terminal','showroom'].includes(id),active:()=>!!selection,close,render(view,send,locked,walk){context={view,send,locked,walk};if(selection)paint();const v=view.world?.venue;if(v){const root=document.getElementById('world-interactions');for(const f of v.fixtures){const b=node('button',f.name);b.type='button';b.disabled=locked;b.onclick=()=>{selection={fixtureId:f.id,venueId:v.id,leaseVersion:view.world.position.leaseVersion};paint();};root.append(b);}}}};
})();
