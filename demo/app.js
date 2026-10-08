// A deliberately separate client-only visual preview. These sample values never
// enter the authoritative game, Supabase, or any financial service.
'use strict';
const $ = id => document.getElementById(id);
const escapeText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash = minor => new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(minor / 100);
const storageKey = 'my-rp-visual-preview-v1';
const fresh = () => ({version:1,region:'Lagos',x:7,y:7,guide:false,home:false,bank:false,lesson:false,shift:false,foodPurchase:false,graphics:'medium',reducedMotion:false,largeText:false,interior:null,roomX:4,roomY:6,facing:'front',lamp:false});
function blocked(x,y) {return [...LAYOUT.buildings,...STREETS.buildings].some(b => x>=b.x && x<b.x+b.w && y>=b.y && y<b.y+b.h);}
function validTile(x,y) {return Number.isInteger(x)&&Number.isInteger(y)&&x>=STREETS.minX&&y>=STREETS.minY&&x<STREETS.maxX&&y<STREETS.maxY&&!blocked(x,y);}
function readState(){
 const result=fresh();
 try {
  const stored=JSON.parse(localStorage.getItem(storageKey)||'null');
  if(!stored||stored.version!==1)return result;
  if(LAYOUT.regions.some(r=>r.name===stored.region))result.region=stored.region;
  if(validTile(stored.x,stored.y)){result.x=stored.x;result.y=stored.y;}
  for(const k of ['guide','home','bank','lesson','shift','foodPurchase','reducedMotion','largeText'])if(typeof stored[k]==='boolean')result[k]=stored[k];
  if(['low','medium','high'].includes(stored.graphics))result.graphics=stored.graphics;
  if(['front','back','left','right'].includes(stored.facing))result.facing=stored.facing;
  if(stored.interior==='shelter'&&roomTile(stored.roomX,stored.roomY)){result.interior='shelter';result.roomX=stored.roomX;result.roomY=stored.roomY;}
 }catch{/* Storage unavailable or invalid: the preview remains usable in memory. */}
 return result;
}
function roomTile(x,y){return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<HOME.width&&y<HOME.height&&!HOME.fixtures.some(f=>x>=f.x&&x<f.x+f.w&&y>=f.y&&y<f.y+f.h);}
function distanceToFixture(x,y,f){return Math.max(f.x-x,0,x-f.x-f.w+1)+Math.max(f.y-y,0,y-f.y-f.h+1);}
let state=readState(),routeTimer=null,walking=false,focusedBefore=null,currentApp='home',task=0;
const camera={x:0,y:0,width:1000,height:640,zoom:1,follow:true};let drag=null,lastDrag=false,walkFrame=null,targetFixture=null;
const projection=(x,y)=>({x:490+(x-y)*31,y:95+(x+y)*16});
function cameraView(recenter=false){
 const svg=$('world-scene'),rect=svg.getBoundingClientRect(),aspect=rect.width&&rect.height?rect.width/rect.height:1250/800;
 camera.width=(rect.width&&rect.width<760?500:1000)/camera.zoom;camera.height=camera.width/aspect;
 if(camera.follow||recenter){const at=projection(state.interior?state.roomX:state.x,state.interior?state.roomY:state.y);camera.x=at.x-camera.width*.55;camera.y=at.y-camera.height*.58-30;}
 const bounds=state.interior?{left:200,right:1050,top:-80,bottom:590}:{left:-1100,right:2400,top:-570,bottom:1370};
 camera.x=Math.max(bounds.left,Math.min(bounds.right-camera.width,camera.x));camera.y=Math.max(bounds.top,Math.min(bounds.bottom-camera.height,camera.y));
 svg.setAttribute('viewBox',`${camera.x} ${camera.y} ${camera.width} ${camera.height}`);$('follow-camera').setAttribute('aria-pressed',String(camera.follow));$('follow-camera').textContent=camera.follow?'Following you':'Find my character';$('zoom-label').textContent=Math.round(camera.zoom*100)+'%';
}
function exitHome(){stopWalk();state.interior=null;state.facing='front';camera.follow=true;update();say('You stepped outside at your home entrance.');}
function enterHome(){stopWalk();closeDialog();closePhone();state.interior='shelter';state.roomX=HOME.spawn.x;state.roomY=HOME.spawn.y;state.facing='back';camera.follow=true;update();say('Inside your home. Walk beside a furnishing and press E, or choose it from Objects.');}
function walkToFixture(id){
 const f=HOME.fixtures.find(f=>f.id===id);if(!state.interior||!f)return;targetFixture=id;closePhone();closeDialog();stopWalk();
 const targets=[];for(let x=0;x<HOME.width;x++)for(let y=0;y<HOME.height;y++)if(roomTile(x,y)&&distanceToFixture(x,y,f)===1)targets.push([x,y]);
 const paths=targets.map(([x,y])=>pathTo(x,y)).filter(Boolean).sort((a,b)=>a.length-b.length);if(!paths.length)return;
 walkPath(paths[0],f.name);
}
function walkPath(path,name){walking=true;camera.follow=true;const next=()=>{const movement=path.shift();if(!movement){walking=false;routeTimer=null;update();say(`Beside ${name}. Press E or choose the nearby action.`);return;}step(...movement);routeTimer=setTimeout(next,state.reducedMotion?110:180);};next();}
function homeInteraction(id){
 const f=HOME.fixtures.find(f=>f.id===id);if(!f||!state.interior||distanceToFixture(state.roomX,state.roomY,f)>1)return;
 if(id==='bed')dialog('Your bed. Your own space.',`<p>Rest in your starter room. Your welcome meal stays available in the kitchen.</p><button class="primary-button full-width" data-action="rest">${state.home?'Rest again':'Rest and collect your welcome meal'}</button>`,'AT HOME');
 else if(id==='pantry')dialog('A little kitchen of your own.',`<p>A welcome plate of rice, beans and plantain is ready. It is one sample welcome meal; there is no repeated cash reward.</p><button class="primary-button full-width" data-action="rest">${state.home?'Enjoy your home kitchen':'Collect the welcome meal'}</button>`,'KITCHEN');
 else dialog(f.name,`<p>${escapeText(f.copy)}</p><div class="info-box">${id==='sofa'?'Take a seat and look around your living room.':id==='desk'?'Your book is open at the first-day guide. Visit foundation school for the sample lesson.':id==='sink'?'Wash your hands at the kitchen sink. This decorative action does not submit a treatment or utility payment.':'A teal shirt and navy trousers: your current starter outfit.'}</div><button class="primary-button full-width" data-action="furniture-done">${id==='sofa'?'Sit for a moment':id==='desk'?'Read the guide':id==='sink'?'Wash hands':'Look at my outfit'}</button>`,'AT HOME');
}

const balance=()=>2000000+(state.shift?25000:0)-(state.foodPurchase?80000:0);
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{/* Private browsing still supports this session. */}}
function say(message){$('status').textContent=message;}
const places={shelter:{name:'Starter home',icon:'⌂',copy:'A safe place to rest, with a welcome meal.'},school:{name:'Foundation school',icon:'▤',copy:'Learn the basics. Your next chapter starts here.'},clinic:{name:'Community clinic',icon:'✚',copy:'Essential care is always within reach.'},market:{name:'Neighbourhood market',icon:'◈',copy:'Fresh food, local traders, familiar faces.'},work:{name:'Work & opportunity',icon:'▤',copy:'A small shift. Your first earned income.'},terminal:{name:'Bus terminal',icon:'↗',copy:'Start here. Explore every state and the FCT.'}};
const quests=[['guide','Meet your welcome guide','guide'],['home','Find your starter home','shelter'],['bank','Check your wallet','bank'],['lesson','Visit foundation school','school'],['shift','Earn your first wage','work']];
function nearby(){
 if(state.interior){const selected=HOME.fixtures.find(f=>f.id===targetFixture);if(selected&&distanceToFixture(state.roomX,state.roomY,selected)<=1)return selected.id;if(Math.abs(state.roomX-HOME.exit.x)+Math.abs(state.roomY-HOME.exit.y)<=1)return 'exit';return HOME.fixtures.find(f=>distanceToFixture(state.roomX,state.roomY,f)<=1)?.id??null;}
 if(Math.abs(state.x-7)+Math.abs(state.y-7)<=1)return 'guide';
 return LAYOUT.buildings.find(b=>Math.abs(state.x-b.door.x)+Math.abs(state.y-b.door.y)<=1)?.id??null;
}
function update(){
 $('balance').textContent=cash(balance());
 const region=LAYOUT.regions.find(r=>r.name===state.region);
 $('region-label').textContent=`${region.name} · ${region.capital}${state.interior?' · At home':''}`;
 const done=quests.filter(([key])=>state[key]).length;
 $('quest-count').textContent=`${done} of 5 steps`;$('quest-progress').value=done;
 $('quest-list').innerHTML=quests.map(([key,label,destination],i)=>`<li class="${state[key]?'done':''}"><button data-quest="${destination}" aria-label="${state[key]?'Completed: ':''}${label}"><span class="quest-dot" aria-hidden="true">${state[key]?'✓':i+1}</span>${label}</button></li>`).join('');
 const n=nearby(),info=state.interior?(n==='exit'?{name:'Front door',icon:'↗',copy:'Return to your neighbourhood.'}:HOME.fixtures.find(f=>f.id===n)?{...HOME.fixtures.find(f=>f.id===n),icon:'⌂'}:null):n==='guide'?{name:'Aunty Bisi',icon:'✦',copy:'Your first friend in the neighbourhood.'}:places[n];
 $('context-name').textContent=info?.name??'Explore your neighbourhood';
 $('context-icon').textContent=info?.icon??'⌖';
 $('context-type').textContent=n==='guide'?'WELCOME GUIDE':n?'NEARBY SERVICE':'ON YOUR WAY';
 $('context-copy').textContent=info?.copy??'Click a location label, or use the movement controls.';
 $('interact-button').disabled=!n||walking;
 $('interact-button').innerHTML=`${n==='exit'?'Step outside':state.interior&&n?'Use':n==='guide'?'Talk':n?'Enter':'Explore'} <kbd>E</kbd>`;
 const at=projection(state.interior?state.roomX:state.x,state.interior?state.roomY:state.y);
 $('player').setAttribute('transform',`translate(${at.x} ${at.y})`);$('player').setAttribute('data-facing',state.facing);
 $('city-layer').toggleAttribute('hidden',!!state.interior);$('home-layer').toggleAttribute('hidden',!state.interior);
 $('home-exit').hidden=!state.interior;$('objects-button').hidden=!state.interior;
 document.querySelector('.scene-caption').textContent=state.interior?'Your home · walk, settle in, make it yours':'Connected streets · a neighbourhood beyond the first block';
 cameraView();
 $('food').value=state.home||state.foodPurchase?100:88;
 $('energy').value=state.home?100:state.shift?76:84;
 document.body.classList.toggle('low-graphics',state.graphics==='low');
 document.body.classList.toggle('reduced-motion',state.reducedMotion);
 document.body.classList.toggle('large-text',state.largeText);
 save();
}
function stopWalk(){if(routeTimer!==null)clearTimeout(routeTimer);routeTimer=null;walking=false;$('player').classList.remove('walking');}
function step(dx,dy){
 state.facing=dx>0?'right':dx<0?'left':dy>0?'front':'back';$('player').setAttribute('data-facing',state.facing);
 const x=state.interior?state.roomX:state.x,y=state.interior?state.roomY:state.y,valid=state.interior?roomTile:validTile;
 if(!valid(x+dx,y+dy)){say(state.interior?'Walk around the furniture.':'The building is in the way. Walk around to its entrance.');return false;}
 if(state.interior){state.roomX+=dx;state.roomY+=dy;}else{state.x+=dx;state.y+=dy;}
 $('player').classList.add('walking');if(walkFrame)clearTimeout(walkFrame);walkFrame=setTimeout(()=>$('player').classList.remove('walking'),200);
 camera.follow=true;update();return true;
}
function pathTo(x,y){
 const sx=state.interior?state.roomX:state.x,sy=state.interior?state.roomY:state.y,valid=state.interior?roomTile:validTile;const queue=[[sx,sy,[]]],seen=new Set([`${sx},${sy}`]);
 for(let i=0;i<queue.length;i++){
  const [cx,cy,path]=queue[i];if(cx===x&&cy===y)return path;
  for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const nx=cx+dx,ny=cy+dy,key=`${nx},${ny}`;if(valid(nx,ny)&&!seen.has(key)){seen.add(key);queue.push([nx,ny,[...path,[dx,dy]]]);}}
 }
 return null;
}
function walkTo(id){
 closePhone();closeDialog();stopWalk();
 if(id==='bank'){openPhone('bank');return;}
 if(state.interior)exitHome();camera.follow=true;
 const target=id==='guide'?{x:7,y:7}:LAYOUT.buildings.find(b=>b.id===id)?.door??STREETS.landmarks.find(l=>l.id===id);
 if(!target)return;
 const path=pathTo(target.x,target.y);
 if(!path){say('That entrance is unavailable. Try another route.');return;}
 const name=id==='guide'?'Aunty Bisi':places[id]?.name??STREETS.landmarks.find(l=>l.id===id)?.name;
 say(`Walking to ${name}. Use a movement key to change direction.`);walking=true;
 const next=()=>{
  const movement=path.shift();
  if(!movement){walking=false;routeTimer=null;update();say(`You are at ${name}. Press E or choose Enter to interact.`);return;}
  step(...movement);routeTimer=setTimeout(next,state.reducedMotion?110:180);
 };next();
}
function lockBackground(locked){document.querySelector('main').inert=locked;document.querySelector('.topbar').inert=locked;}
function closePhone(){if($('phone').hidden)return;$('phone').hidden=true;document.body.classList.remove('phone-open');lockBackground(false);focusedBefore?.focus();}
function openPhone(app='home'){
 stopWalk();closeDialog();if($('phone').hidden)focusedBefore=document.activeElement;
 currentApp=app;$('phone').hidden=false;document.body.classList.add('phone-open');lockBackground(true);renderPhone(app);$('close-phone').focus();
}
function closeDialog(){const d=$('service-dialog');if(d.open)d.close();}
function dialog(title,content,kicker='NEIGHBOURHOOD'){
 closePhone();stopWalk();focusedBefore=document.activeElement;
 $('service-kicker').textContent=kicker;
 $('service-content').innerHTML=`<h2 id="service-title">${title}</h2>${content}`;
 if(!$('service-dialog').open)$('service-dialog').showModal();
 $('close-dialog').focus();
}
function interact(){
 const place=nearby();if(!place||walking)return;
 if(state.interior){if(place==='exit')exitHome();else homeInteraction(place);return;}
 if(place==='guide'){
  state.guide=true;update();
  dialog('Welcome, Timi.',`<div class="portrait" aria-hidden="true">✦</div><p>“You do not have to have it all figured out today. Let’s get you settled, then we can find you a little work.”</p><div class="info-box"><strong>Aunty Bisi · Citizen welcome guide</strong><br>Your shelter and a welcome meal are ready. You can work while you study. Essential care remains available.</div><div class="button-row"><button class="primary-button" data-action="go-home">Show me my home ↗</button><button class="secondary-button" data-action="go-work">Find work</button></div>`,'YOUR FIRST FRIEND');
  return;
 }
 if(place==='shelter')enterHome();
 if(place==='school')school();
 if(place==='work')work();
 if(place==='market')market();
 if(place==='clinic')clinic();
 if(place==='terminal')travel();
}
function school(){dialog('Your foundation starts here.',`<div class="interior-picture" aria-hidden="true">▤ <span>▥</span> ✎</div><p>Five days of practical learning: your first day, money and work, health and safety, rights and contracts, and civic life.</p><div class="info-box"><strong>Day 1 · Finding your feet</strong><br>School and starter work can run alongside each other. Completing this short preview lesson does not award a game certificate.</div><button class="primary-button full-width" data-action="lesson" ${state.lesson?'disabled':''}>${state.lesson?'Preview lesson complete':'Try the first-day practice'}</button>`,'FOUNDATION SCHOOL');}
function work(){
 if(state.shift){dialog('Your first wage is in.',`<div class="portrait" aria-hidden="true">✓</div><p>You completed the sample shift and earned ${cash(25000)}.</p><div class="info-box">Receipt DEMO-SHIFT-001 · settled once<br>This preview has one sample shift. The full game supports additional work through its authoritative command system.</div><button class="primary-button full-width" data-action="bank">See your wallet</button>`,'WORK & OPPORTUNITY');return;}
 dialog('A small shift. A real first step.',`<span class="tag">SAMPLE SHIFT · NO QUALIFICATION REQUIRED</span><div class="service-card"><h3>Parcel sorting assistant</h3><p>Help a local dispatch desk sort, check, and hand over three parcels.</p><strong>${cash(25000)} · sample wage</strong></div><p>Try three untimed decisions using the labelled buttons. You will receive one sample receipt.</p><button class="primary-button full-width" data-action="start-task">Start the preview shift</button>`,'WORK & OPPORTUNITY');
}
const tasks=[
 {title:'Sort the delivery.',copy:'The label says “Lagos delivery”. Which tray should this parcel go into?',options:['Lagos tray','Abuja tray','Damaged items tray'],answer:0},
 {title:'Handle it with care.',copy:'The next parcel is marked FRAGILE. What is the appropriate handling?',options:['Stack heavy boxes on top','Keep it upright and protect it','Throw it into the van'],answer:1},
 {title:'Finish the handover.',copy:'The parcels are ready for the courier. How do you keep a record?',options:['Leave without recording anything','Ask the sender to pay again','Confirm the handover receipt'],answer:2}
];
function taskScreen(message=''){
 const item=tasks[task];
 dialog(item.title,`<div class="task-number">PARCEL SORTING · STEP ${task+1} OF 3</div><p>${item.copy}</p>${message?`<div class="info-box" role="status">${message}</div>`:''}<div class="task-options">${item.options.map((text,i)=>`<button data-answer="${i}">${text}</button>`).join('')}</div><p class="small-print">No timer. No penalty for retrying. Sample rewards stay within this preview.</p>`,'YOUR FIRST SHIFT');
}
function market(){dialog('Good food. Familiar faces.',`<div class="interior-picture" aria-hidden="true">◈ <span>◉</span> ◈</div><p>Fresh produce and a warm meal from the neighbourhood market.</p><div class="service-card"><h3>Rice, beans & plantain</h3><p>A sample meal to restore the food meter.</p><strong>${cash(80000)} · demo NGN</strong></div><button class="primary-button full-width" data-action="buy-meal" ${state.foodPurchase?'disabled':''}>${state.foodPurchase?'Meal purchased · receipt available':'Review sample purchase'}</button><p class="small-print">Your free welcome meal remains available at the starter home.</p>`,'NEIGHBOURHOOD MARKET');}
function clinic(){dialog('Care within reach.',`<div class="interior-picture" aria-hidden="true">✚ <span>▥</span> ✚</div><p>Your sample citizen is healthy. The community clinic provides a dependable place for essential care.</p><div class="info-box"><strong>Health · 100 / 100</strong><br>Game conditions and care are handled by the full simulation. This visual preview has no medical assessment or paid treatment.</div><button class="primary-button full-width" data-action="care-info">Read the care pathway</button>`,'COMMUNITY CLINIC');}
function travel(){dialog('A whole country ahead.',`<div class="interior-picture" aria-hidden="true">↗ <span>▰</span> ⌖</div><p>Choose any Nigerian state or the FCT to preview its location label. All destinations currently share this representative street layout.</p><label class="form-label" for="destination">Preview destination</label><select id="destination">${LAYOUT.regions.map(r=>`<option value="${escapeText(r.name)}" ${state.region===r.name?'selected':''}>${escapeText(r.name)} · ${escapeText(r.capital)}</option>`).join('')}</select><div class="info-box">Preview travel is free and instant. The full game’s route fares, timers, reservations, and arrival rules remain separate.</div><button class="primary-button full-width" data-action="travel">Explore this destination</button>`,'BUS TERMINAL');}
function phoneHeader(title,copy=''){return `<button class="back-button" data-app="home">← Phone home</button><h2>${title}</h2>${copy?`<p class="phone-subtitle">${copy}</p>`:''}`;}
function renderPhone(app){
 currentApp=app;let html='';
 if(app==='home')html=`<p class="phone-greeting">GOOD MORNING, TIMI</p><h2>Your city.<br>Your next chapter.</h2><div class="phone-wallet"><small>DEMO WALLET</small><strong>${cash(balance())}</strong><span>Virtual sample money · browser only</span></div><div class="app-grid">${[['bank','◇','Bank'],['jobs','▤','Jobs'],['school','▥','School'],['map','⌖','Map'],['care','✚','Care'],['home-info','⌂','Home'],['feed','◉','NaijaFeed'],['civic','⚑','Civic life'],['settings','☷','Settings']].map(([id,icon,name])=>`<button data-app="${id}"><span aria-hidden="true">${icon}</span>${name}</button>`).join('')}</div><div class="info-box">Your first-day guide is nearby. Start small: a home, a lesson, a shift.</div>`;
 if(app==='bank'){
  state.bank=true;update();
  const receipts=[['Welcome provision','DEMO-START-001',2000000],...(state.shift?[['Parcel sorting shift','DEMO-SHIFT-001',25000]]:[]),...(state.foodPurchase?[['Market meal','DEMO-MEAL-001',-80000]]:[])];
  html=phoneHeader('Your wallet.','Sample receipts. No real money or account connection.')+`<div class="phone-wallet"><small>AVAILABLE DEMO NGN</small><strong>${cash(balance())}</strong><span>Starter provision + earned wage − spending</span></div><h3>Activity</h3><ul class="receipt-list">${receipts.map(([name,id,amount])=>`<li><span>${name}<small>${id} · confirmed sample</small></span><strong class="${amount>0?'positive':''}">${amount>0?'+':'−'}${cash(Math.abs(amount))}</strong></li>`).join('')}</ul><div class="info-box">This is a sample wallet. Demo funds stay in this browser, with one sample receipt for each completed activity.</div>`;
 }
 if(app==='jobs')html=phoneHeader('Find your first shift.','Start earning while you study.')+`<div class="service-card"><span class="tag">STARTER JOB</span><h3>Parcel sorting assistant</h3><p>Three untimed task choices. A sample ${cash(25000)} wage on completion.</p><button class="primary-button" data-walk="work">${state.shift?'Visit the work desk':'Walk to the work desk ↗'}</button></div><div class="info-box">Full-game jobs, hiring, payroll, and professional eligibility are still being expanded. This preview demonstrates one starting activity.</div>`;
 if(app==='school')html=phoneHeader('Learn your way forward.','Foundation school · representative lesson')+`<div class="service-card"><h3>Day 1 · Finding your feet</h3><p>Visit your guide, discover essential services, and see how work fits alongside education.</p><button class="primary-button" data-walk="school">Walk to school ↗</button></div><div class="info-box">The full five-day programme, examinations, and qualifications belong to the full game. The preview lesson awards no qualification.</div>`;
 if(app==='objects')html=phoneHeader('Inside your home.','Choose an object to walk beside it.')+`<div class="location-list">${HOME.fixtures.map(f=>`<button data-fixture="${f.id}"><span>${escapeText(f.name)}<small>${escapeText(f.copy)}</small></span><span>↗</span></button>`).join('')}</div><button class="secondary-button full-width" data-action="exit-home">Step outside</button>`;
 if(app==='map')html=phoneHeader('Your neighbourhood.','Choose a place to walk there.')+`<div class="location-list">${Object.entries(places).map(([id,info])=>`<button data-walk="${id}"><span>${info.name}<small>${info.copy}</small></span><span>↗</span></button>`).join('')}</div><div class="info-box">${escapeText(state.region)} · representative Centre district<br>The centre entrances mirror the development game. Connected surrounding blocks extend this exploration sample.</div><h3>Connected streets</h3><div class="location-list">${STREETS.landmarks.map(l=>`<button data-walk="${l.id}">${l.name} ↗</button>`).join('')}</div>`;
 if(app==='care')html=phoneHeader('Essential care.','Sample citizen health: 100 / 100.')+`<div class="service-card"><h3>Community clinic</h3><p>A local fallback for essential game care.</p><button class="primary-button" data-walk="clinic">Walk to the clinic ↗</button></div><div class="info-box">For a game emergency, the full system connects transport, assessment, supplies, treatment, and recovery. This sample does not simulate an emergency.</div>`;
 if(app==='home-info')html=phoneHeader('A safe starting point.','Your shelter stays accessible.')+`<div class="service-card"><h3>Starter home</h3><p>A bed, a welcome meal, and space to begin.</p><button class="primary-button" data-walk="shelter">Walk home ↗</button></div>`;
 if(app==='feed'||app==='civic')html=phoneHeader(app==='feed'?'NaijaFeed.':'Civic life.','Part of the full game’s build scope.')+`<div class="info-box">${app==='feed'?'Social posts, events, discovery, and moderated media':'Government, public budgets, political parties, elections, and due process'} are specified in the Bible and remain unfinished. This preview focuses on your first day.</div><button class="secondary-button full-width" data-app="map">Explore the neighbourhood</button>`;
 if(app==='settings')html=phoneHeader('Make it comfortable.','Visual settings do not change sample rewards.')+`<label for="graphics">Graphics</label><select id="graphics"><option value="low" ${state.graphics==='low'?'selected':''}>Low · fewer ambient citizens</option><option value="medium" ${state.graphics==='medium'?'selected':''}>Medium · default street scene</option><option value="high" ${state.graphics==='high'?'selected':''}>High · same prototype detail</option></select><div class="setting-row"><label for="reduced-motion">Reduced motion</label><input id="reduced-motion" type="checkbox" ${state.reducedMotion?'checked':''}></div><div class="setting-row"><label for="large-text">Larger interface text</label><input id="large-text" type="checkbox" ${state.largeText?'checked':''}></div><div class="setting-row"><span>Audio & external media</span><strong>Off</strong></div><div class="info-box">This preview downloads no fonts, music, or external art. Core actions remain available in every graphics mode.</div><button class="secondary-button full-width" data-action="reset-review">Reset this preview</button><p class="phone-subtitle">Reset only removes this preview’s local sample progress. It does not contact the game or your accounts.</p>`;
 $('phone-content').innerHTML=html;
}
function help(){dialog('A life of your own.',`<p>This playable visual prototype lets you try a representative Nigerian street, sample services, and an in-game phone.</p><div class="info-box"><strong>Move:</strong> WASD, arrow keys, or the on-screen arrows.<br><strong>Visit:</strong> click a building label, or choose a place in the phone map.<br><strong>Interact:</strong> E or the nearby action.<br><strong>Phone:</strong> P. Close menus with Escape.<br><strong>Look around:</strong> drag or scroll the street. Use + / − to zoom and Find my character to return.<br><strong>At home:</strong> choose Objects, walk beside a furnishing, then press E.</div><p>Follow Aunty Bisi’s first-day list. Your sample progress is stored only in this browser and can be reset in Settings.</p><p class="small-print">The full multiplayer game is still being built. This preview does not sign in, reach Supabase, submit game commands, or award live money and credentials. Geography and art remain representative.</p><button class="primary-button full-width" data-action="go-guide">Meet your welcome guide ↗</button>`,'PLAYABLE VISUAL PREVIEW');}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('button,[data-place],[data-furniture],[data-room-exit]');if(!button||button.disabled||lastDrag)return;
 if(button.dataset.furniture){walkToFixture(button.dataset.furniture);return;}
 if(button.dataset.fixture){walkToFixture(button.dataset.fixture);return;}
 if(button.dataset.roomExit){closeDialog();closePhone();stopWalk();const path=pathTo(HOME.exit.x,HOME.exit.y);if(path)walkPath(path,'Front door');return;}
 if(button.dataset.place){walkTo(button.dataset.place);return;}
 if(button.dataset.direction){if(!$('phone').hidden||$('service-dialog').open)return;stopWalk();const d={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[button.dataset.direction];step(...d);return;}
 if(button.dataset.quest){walkTo(button.dataset.quest);return;}
 if(button.dataset.walk){walkTo(button.dataset.walk);return;}
 if(button.dataset.app){renderPhone(button.dataset.app);return;}
 if(button.dataset.answer!==undefined){
  if(state.shift)return;
  if(Number(button.dataset.answer)!==tasks[task].answer){taskScreen('Try again. Read the label and choose the safest recorded handover.');return;}
  task++;if(task<tasks.length)taskScreen();else{state.shift=true;update();say('Sample shift complete. ₦250 earned once.');work();}return;
 }
 const action=button.dataset.action;
 if(action==='exit-home')exitHome();
 if(action==='furniture-done'){closeDialog();say('You spent a moment with this furnishing. Keep exploring your home.');}
 if(action==='go-home')walkTo('shelter');
 if(action==='go-work')walkTo('work');
 if(action==='go-guide')walkTo('guide');
 if(action==='rest'){state.home=true;update();say('Welcome meal received. Food and energy restored.');closeDialog();}
 if(action==='bank')openPhone('bank');
 if(action==='lesson')dialog('Work and study, together.',`<p>You have not completed your foundation programme yet. Can you still take a starter shift?</p><div class="task-options"><button data-action="lesson-correct">Yes. Starter work remains available while I study.</button><button data-action="lesson-retry">No. I must pass all exams first.</button></div>`,'DAY 1 · PREVIEW PRACTICE');
 if(action==='lesson-retry'){$('service-content').insertAdjacentHTML('beforeend','<div class="info-box" role="status">Try again. Basic starter work does not require a qualification.</div>');}
 if(action==='lesson-correct'){state.lesson=true;update();dialog('One step forward.',`<div class="portrait" aria-hidden="true">✓</div><p>Your sample first-day practice is complete. A full foundation programme still requires its five lessons and official exam.</p><button class="primary-button full-width" data-action="go-work">Find a starter shift ↗</button>`,'PREVIEW LESSON COMPLETE');}
 if(action==='start-task'){task=0;taskScreen();}
 if(action==='buy-meal')dialog('Review your sample purchase.',`<p>Rice, beans & plantain · ${cash(80000)}</p><div class="info-box">Demo wallet after purchase: <strong>${cash(balance()-80000)}</strong><br>One sample meal and one sample receipt. No real money.</div><div class="button-row"><button class="secondary-button" data-action="market-cancel">Keep exploring</button><button class="primary-button" data-action="confirm-meal">Confirm sample purchase</button></div>`,'MARKET PURCHASE');
 if(action==='confirm-meal'&&!state.foodPurchase){state.foodPurchase=true;update();dialog('Enjoy your meal.',`<p>Food restored. ${cash(80000)} deducted from the sample wallet.</p><div class="info-box">Receipt DEMO-MEAL-001 · one confirmed sample purchase</div><button class="primary-button full-width" data-action="bank">See your wallet</button>`,'SAMPLE RECEIPT');}
 if(action==='market-cancel')closeDialog();
 if(action==='travel'){const destination=$('destination')?.value;if(LAYOUT.regions.some(r=>r.name===destination)){state.region=destination;state.x=17;state.y=8;update();closeDialog();say(`Now previewing ${destination}. This is the same representative street layout.`);}}
 if(action==='care-info')dialog('A connected care pathway.',`<p>In the full game, essential assessment leads to available care. Treatment reserves the fee and necessary medicine; recovery settles once. Emergency transport reaches the clinic without duplicate journeys.</p><div class="info-box">This scene is a service preview. No care fee, diagnosis, treatment, or insurance claim is submitted.</div>`,'COMMUNITY CARE');
 if(action==='reset-review')dialog('Start this preview again?',`<p>Your sample steps, receipts, destination, and preferences will return to their initial values.</p><div class="button-row"><button class="secondary-button" data-action="reset-cancel">Keep my progress</button><button class="primary-button" data-action="reset-confirm">Reset local preview</button></div>`,'LOCAL PREVIEW');
 if(action==='reset-confirm'){state=fresh();update();closeDialog();say('Local preview reset. Meet Aunty Bisi to begin again.');}
 if(action==='reset-cancel'){closeDialog();openPhone('settings');}
});
document.addEventListener('change',event=>{
 if(event.target.id==='graphics')state.graphics=event.target.value;
 if(event.target.id==='reduced-motion')state.reducedMotion=event.target.checked;
 if(event.target.id==='large-text')state.largeText=event.target.checked;
 update();
});
$('home-exit').onclick=exitHome;$('objects-button').onclick=()=>openPhone('objects');
$('journal-button').onclick=()=>{const card=document.querySelector('.journey-card');card.hidden=!card.hidden;$('journal-button').setAttribute('aria-expanded',String(!card.hidden));};
$('zoom-in').onclick=()=>{camera.zoom=Math.min(2,camera.zoom+.2);cameraView();};$('zoom-out').onclick=()=>{camera.zoom=Math.max(.6,camera.zoom-.2);cameraView();};$('follow-camera').onclick=()=>{camera.follow=true;cameraView(true);};
const surface=$('world-scene');
surface.addEventListener('wheel',event=>{if(!$('phone').hidden||$('service-dialog').open)return;event.preventDefault();camera.follow=false;const factor=camera.width/(surface.getBoundingClientRect().width||1250);camera.x+=Math.max(-180,Math.min(180,event.deltaX))*factor;camera.y+=Math.max(-180,Math.min(180,event.deltaY))*factor;cameraView();},{passive:false});
surface.addEventListener('pointerdown',event=>{if(!$('phone').hidden||$('service-dialog').open)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,cx:camera.x,cy:camera.y,moved:false};});
surface.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)<7&&!drag.moved)return;drag.moved=true;camera.follow=false;stopWalk();surface.setPointerCapture?.(event.pointerId);const factor=camera.width/(surface.getBoundingClientRect().width||1250);camera.x=drag.cx-dx*factor;camera.y=drag.cy-dy*factor;cameraView();});
const endDrag=()=>{if(drag?.moved){lastDrag=true;setTimeout(()=>lastDrag=false,0);}drag=null;};surface.addEventListener('pointerup',endDrag);surface.addEventListener('pointercancel',endDrag);
window.addEventListener('resize',()=>cameraView());
$('phone-button').onclick=()=>openPhone('home');$('wallet-button').onclick=()=>openPhone('bank');$('settings-button').onclick=()=>openPhone('settings');$('close-phone').onclick=closePhone;
$('guide-button').onclick=()=>walkTo('guide');$('interact-button').onclick=interact;$('map-button').onclick=()=>openPhone('map');$('places-button').onclick=()=>openPhone('map');$('jobs-button').onclick=()=>openPhone('jobs');$('help-button').onclick=help;
$('close-dialog').onclick=closeDialog;$('service-dialog').addEventListener('close',()=>{focusedBefore?.focus();});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'){closePhone();closeDialog();stopWalk();update();return;}
 if(!$('phone').hidden){
  if(event.key==='Tab'){
   const items=[...$('phone').querySelectorAll('button:not(:disabled),select,input,[tabindex="0"]')];const first=items[0],last=items.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }return;
 }
 if($('service-dialog').open||['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;
 if(event.target.closest?.('[data-furniture],[data-room-exit]')&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.target.closest('[data-furniture],[data-room-exit]').dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}
 if(event.target.closest?.('[data-place]')&&(event.key==='Enter'||event.key===' ')){event.preventDefault();walkTo(event.target.closest('[data-place]').dataset.place);return;}
 const key=event.key.toLowerCase(),direction={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]}[key];
 if(direction){event.preventDefault();stopWalk();step(...direction);return;}
 if(key==='e'){event.preventDefault();interact();}if(key==='p'){event.preventDefault();openPhone();}
});
update();
