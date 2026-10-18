/* The world stays visible. Panels reuse the authoritative game's existing controls. */
(() => {
  const $ = id => document.getElementById(id), stage = $('game-stage'), drawer = $('game-drawer');
  const pages = new Map([...document.querySelectorAll('[data-game-page]')].map(e => [e.dataset.gamePage, e]));
  const titles = {phone:'Your phone',map:'Places & nearby objects',home:'Your home',furnish:'Furniture & room layout',appearance:'Your wardrobe',work:'Work',learn:'School & careers',people:'People',money:'Wallet & banking',business:'Business & inventory',travel:'Travel & vehicles',health:'Care & coverage',civic:'Your community',activity:'Recent activity',settings:'Settings',help:'How to play'};
  let active = false, page = null, returnFocus = null, actor = null, location = null, rotateDismissed = false, fullscreenBusy = false, generation = 0, latestView = null;
  const camera = { mode: 'overview', available: false };
  const icons = {
    home:'M3 10.5 12 3l9 7.5M5 9v12h14V9M9 21v-8h6v8',
    work:'M8 7V4h8v3M3 8h18v12H3zM3 12l9 3 9-3M10 13h4',
    store:'M4 10v11h16V10M3 10l2-7h14l2 7M3 10c0 4 6 4 6 0 0 4 6 4 6 0 0 4 6 4 6 0M9 21v-7h6v7',
    map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16',
    phone:'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM10 5h4M11 19h2',
    expand:'M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5',
    person:'M15 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM6 21v-8a6 6 0 0 1 12 0v8M9 13v8M15 13v8',
    camera:'M3 7h4l2-3h6l2 3h4v14H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    look:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    furnish:'M4 12V6h16v6M2 12h4v5h12v-5h4v9H2zM5 21v1M19 21v1',
    appearance:'M9 6a3 3 0 1 1 3 3v3L2 18v3h20v-3l-10-6',
    learn:'M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-3-1-7-2-10 1ZM12 5v15',
    people:'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 21v-3a7 7 0 0 1 14 0v3M18 4a3 3 0 0 1 0 6M21 15a5 5 0 0 1 2 4',
    money:'M3 6h16v14H3zM3 6l14-3v3M15 11h7v5h-7zM18 13v1',
    business:'M3 21V5h12v16M15 10h6v11M7 9h4M7 13h4M7 17h4M1 21h22',
    travel:'M4 10l2-6h12l2 6M3 10h18v9H3zM6 14h2M16 14h2M5 19v3M19 19v3',
    health:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    civic:'m2 9 10-6 10 6ZM4 10v9M9 10v9M15 10v9M20 10v9M2 21h20',
    activity:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 2',
    settings:'M12 3v3M12 18v3M3 12h3M18 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
    help:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM9 8a3 3 0 1 1 5 2c-1 1-2 1-2 4M12 17v1'
  };
  for (const app of document.querySelectorAll('.game-app-grid [data-game-menu]')) {const slot=app.querySelector('span');if(slot&&icons[app.dataset.gameMenu]){slot.textContent='';slot.dataset.icon=app.dataset.gameMenu;}}
  for (const slot of document.querySelectorAll('[data-icon]')) {
    const path=icons[slot.dataset.icon];if(!path)continue;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    for(const [name,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.65','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(name,value);
    const shape=document.createElementNS('http://www.w3.org/2000/svg','path');shape.setAttribute('d',path);svg.append(shape);slot.append(svg);
  }
  function paintCamera(){
    for(const button of document.querySelectorAll('[data-camera-mode]')){button.disabled=!camera.available&&button.dataset.cameraMode!=='overview';button.setAttribute('aria-pressed',String(button.dataset.cameraMode===camera.mode));}
    $('game-camera').dataset.available=String(camera.available);$('game-camera-status').textContent=camera.available?({'third-person':'Following your character',close:'Close camera',overview:'Overhead camera'}[camera.mode]??''):'Light graphics: overhead view';$('game-touch-look').hidden=!camera.available;
  }
  function destination(kind){const world=latestView?.world;if(!world)return null;return kind==='home'?world.residence:world.map?.buildings?.find(building=>building.id===(kind==='store'?'showroom':'work'));}
  function paintDestinations(locked){for(const button of document.querySelectorAll('[data-game-destination]'))button.disabled=!!locked||!!latestView?.world?.trip||!destination(button.dataset.gameDestination);}
  function setFullscreenLabel(){const full=document.fullscreenElement===stage;$('game-fullscreen').lastElementChild.textContent=full?'Exit':'Screen';$('game-fullscreen').setAttribute('aria-label',full?'Exit full screen':'Enter full screen');}

  const release = () => window.dispatchEvent(new Event('game-input-release'));
  const move = (node, destination) => { if (node) pages.get(destination).append(node); };
  const card = (heading, destination) => move($(heading)?.closest('.card'), destination);
  for (const [id, destination] of Object.entries({
    'needs-title':'home','family-title':'home','privacy-title':'settings','work-title':'work','school-title':'learn','exam-title':'learn','career-title':'learn',
    'history-title':'activity','company-title':'business','employment-title':'work','bank-title':'money'
  })) card(id, destination);
  for (const [id, destination] of Object.entries({
    'civic-panel':'civic','insurance-panel':'health','healthcare-panel':'health','mobility-panel':'travel','appearance-panel':'appearance',
    'furnishing-panel':'furnish','relationships-panel':'people','home-visits-panel':'home','property-panel':'home','teaching-panel':'learn','governance-panel':'business',
    'world-neighbours':'people','world-npcs':'people','world-navigation':'map','world-interactions':'map','guide-message':'help',
    'travel-panel':'travel','travel-actions':'travel','travel-status':'travel','refresh':'settings','graphics':'settings','connection-status':'settings',
    'pwa-status':'settings','install-game':'settings'
  })) move($(id), destination);
  // Keep labels attached to their inputs while moving graphics preferences.
  const graphicsLabel = document.querySelector('label[for="graphics"]');
  if (graphicsLabel) { graphicsLabel.append($('graphics')); move(graphicsLabel, 'settings'); }
  move($('data-saver').closest('label'), 'settings');
  move(document.querySelector('#citizen-panel > .summary'), 'money');
  move(document.querySelector('#citizen-panel > .section-heading'), 'help');
  const worldCard = document.querySelector('.world-card');
  $('game-world').append($('world-canvas'));
  $('game-place').append($('world-title'), $('world-location'));
  $('game-movement').append($('world-controls'));
  for (const hint of [...worldCard.querySelectorAll('.hint')]) move(hint, 'help');
  worldCard.hidden = true;
  document.querySelector('#citizen-panel > .columns').hidden = true;
  const portalIds = ['notice','retry-panel','account-logout','connection-takeover'];
  const anchors = new Map(portalIds.map(id => {const node=$(id),anchor=document.createComment('Return '+id);node.before(anchor);return [id,anchor];}));
  function portals(playing) {
    for (const id of portalIds) {
      const node=$(id);if(playing)(id==='account-logout'?pages.get('settings'):$('game-alerts')).append(node);
      else anchors.get(id).after(node);
    }
    $('connection-panel').hidden = playing;
  }
  function updateViewport() {
    const portrait = window.innerHeight > window.innerWidth;
    $('game-rotate').hidden = !active || !portrait || rotateDismissed;
    stage.classList.toggle('game-portrait', portrait);
  }
  function open(next, trigger=document.activeElement) {
    if (!active || !pages.has(next)) return;
    if (page !== next) release();
    if (!page) returnFocus=trigger;
    page=next;drawer.hidden=false;$('game-drawer-title').textContent=titles[next];
    for(const [id,node] of pages) node.hidden=id!==next;
    if(next==='map')window.CityMapUI?.paint();
    for(const b of document.querySelectorAll('[data-game-menu]')) b.setAttribute('aria-expanded',String(b.dataset.gameMenu===next));
    stage.classList.add('game-menu-open');
    $('game-back').hidden=next==='phone';
    $('game-drawer-close').focus({preventScroll:true});
  }
  function close(restore=true) {
    if(page)release();page=null;drawer.hidden=true;stage.classList.remove('game-menu-open');
    for(const node of pages.values())node.hidden=true;
    for(const b of document.querySelectorAll('[data-game-menu]'))b.setAttribute('aria-expanded','false');
    if(restore&&active)(returnFocus?.isConnected&&returnFocus.matches('button,a[href],input,select,textarea,[tabindex]')&&!returnFocus.disabled&&returnFocus.closest('[hidden]')===null?returnFocus:$('game-phone')).focus({preventScroll:true});
    returnFocus=null;
  }
  function reset() {
    generation++;release();close(false);active=false;actor=null;location=null;latestView=null;stage.hidden=true;portals(false);document.body.classList.remove('is-playing');
    $('game-display-status').textContent='';$('game-name').textContent='';$('game-wallet').textContent='';$('game-design-xp').textContent='';$('game-design-xp').hidden=true;$('game-connection').textContent='';$('game-activity').textContent='';
    $('world-title').textContent='';$('world-location').textContent='';$('game-context-actions').replaceChildren();$('game-context-label').textContent='';
    $('game-needs').hidden=true;$('game-rotate').hidden=true;$('game-phone-clock').textContent='';$('game-phone-network').textContent='';stage.classList.remove('game-furnishing');
    for(const meter of stage.querySelectorAll('meter')){meter.value=0;meter.removeAttribute('aria-label');}
    if(document.fullscreenElement===stage){try{screen.orientation?.unlock?.();}catch{}Promise.resolve(document.exitFullscreen?.()).catch(()=>{});}
  }
  function render(view, locked) {
    if(!view?.citizen){if(active)reset();return;}
    if(actor!==view.accountId){if(active)reset();actor=view.accountId;}
    if(!active){active=true;stage.hidden=false;portals(true);document.body.classList.add('is-playing');updateViewport();}
    latestView=view;
    $('game-name').textContent=view.citizen.name;
    $('game-wallet').textContent=new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(view.balance/100);
    const designXp=view.life?.skills?.['home-design'];$('game-design-xp').hidden=!Number.isSafeInteger(designXp)||designXp<0;$('game-design-xp').textContent=Number.isSafeInteger(designXp)&&designXp>=0?`Home Design · ${designXp} XP`:'';
    const connected=window.WorldSync?.ready()!==false;$('game-connection').textContent=connected?(locked?'Saving…':'Connected'):'Reconnecting…';$('game-state').dataset.connection=connected?(locked?'saving':'connected'):'offline';$('game-phone-network').textContent=connected?'MY RP':'Offline';
    const clock=new Date(Number.isFinite(view.serverTime)?view.serverTime:Date.now());$('game-phone-clock').textContent=clock.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false});$('game-phone-clock').dateTime=clock.toISOString();
    const needs=view.life?.needs;$('game-needs').hidden=!needs;
    if(needs)for(const [name,label] of [['hunger','Food'],['energy','Energy'],['health','Health']]){const m=$('game-'+name);m.value=needs[name];m.setAttribute('aria-label',`${label}: ${needs[name]} of 100`);}
    const care=view.world?.homeCare;for(const [name,label] of [['hygiene','Hygiene'],['bladder','Bathroom comfort'],['comfort','Comfort']]){const value=care?.[name],present=Number.isFinite(value);$('game-'+name+'-row').hidden=!present;if(present){const meter=$('game-'+name);meter.value=value;meter.setAttribute('aria-label',`${label}: ${Math.round(value)} of 100`);}}stage.classList.toggle('has-home-care',!!care);
    const world=view.world, pos=world?.position;
    $('game-activity').textContent=world?.trip?.status==='travelling'?'On the road':view.work?.active?'Work in progress':pos?.activity?.kind?({Sit:'Sitting',Rest:'Resting',Read:'Reading',Wash:'Washing',Dress:'At the wardrobe',Shower:'Showering',Toilet:'Using the bathroom',Clean:'Cleaning',RequestFoodAssistance:'Getting a meal'}[pos.activity.kind]??'Using an object'):'Tap a door or floor to explore';
    const actions=$('game-context-actions');actions.replaceChildren();
    const sources=[...document.querySelectorAll('#world-interactions button, #travel-actions button')].filter(b=>!b.disabled);
    for(const source of sources.slice(0,1)){const b=document.createElement('button');b.type='button';b.textContent=source.textContent;b.disabled=!!locked;b.addEventListener('click',()=>source.click());actions.append(b);}
    $('game-context-label').textContent=world?.home?'At home':pos?.interior?'Inside':'Nearby';
    $('game-more-actions').textContent=sources.length>1?'Nearby actions':'Places';
    const nextLocation=pos?`${pos.region}:${pos.interior??''}`:null;
    if(location&&nextLocation!==location){
      release();
      const destination={school:'learn',clinic:'health',market:'business',work:'work',terminal:'travel'}[pos?.interior];
      if(destination&&!window.VenueUI?.handles(pos?.interior))open(destination);else if(page)close();
    }
    location=nextLocation;
    // UI-only navigation remains usable while commands await confirmation or reconnect.
    for(const b of stage.querySelectorAll('[data-game-ui]:not(#object-menu button):not(#venue-menu button):not(#driving-hud button)'))b.disabled=b.id==='game-fullscreen'&&fullscreenBusy;paintCamera();paintDestinations(locked);
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest?.('[data-game-menu]');if(b)open(b.dataset.gameMenu,b);
    const go=event.target.closest?.('[data-game-destination]');if(go&&!go.disabled&&active){const building=destination(go.dataset.gameDestination),world=latestView?.world;if(building&&world){release();close(false);window.dispatchEvent(new CustomEvent('building-select',{detail:{buildingId:building.id,leaseVersion:world.position.leaseVersion}}));}}
    const cameraButton=event.target.closest?.('[data-camera-mode]');if(cameraButton&&!cameraButton.disabled&&active){release();window.dispatchEvent(new CustomEvent('camera-mode',{detail:{mode:cameraButton.dataset.cameraMode}}));}
  });
  $('game-drawer-close').addEventListener('click',()=>close());
  $('game-back').addEventListener('click',()=>open('phone'));
  $('game-rotate-dismiss').addEventListener('click',()=>{rotateDismissed=true;updateViewport();});
  document.addEventListener('keydown',event=>{if(active&&event.key==='Escape'&&page){event.preventDefault();close();}});
  window.addEventListener('npc-select',()=>open('people'));
  window.addEventListener('camera-state',event=>{const state=event.detail;if(!state)return;camera.available=state.available===true;camera.mode=['third-person','close','overview'].includes(state.mode)?state.mode:'overview';paintCamera();});
  window.addEventListener('furniture-edit',event=>{
    stage.classList.toggle('game-furnishing',!!event.detail);
  });
  const resize=()=>{release();updateViewport();};
  window.addEventListener('resize',resize);window.addEventListener('orientationchange',resize);
  window.visualViewport?.addEventListener('resize',resize);
  window.addEventListener('blur',release);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
  document.addEventListener('fullscreenchange',()=>{resize();setFullscreenLabel();if(document.fullscreenElement!==stage){$('game-display-status').textContent='';try{screen.orientation?.unlock?.();}catch{}}});
  $('game-fullscreen').addEventListener('click',async()=>{
    if(!active||fullscreenBusy)return;release();const version=generation;fullscreenBusy=true;$('game-fullscreen').disabled=true;
    try{
      if(document.fullscreenElement===stage){await document.exitFullscreen();return;}
      if(!stage.requestFullscreen)throw Error('unsupported');
      await stage.requestFullscreen();
      if(version!==generation||!active){if(document.fullscreenElement===stage)await document.exitFullscreen();return;}
      try{if(screen.orientation?.lock)await screen.orientation.lock('landscape');}catch{/* Rotate manually when browser orientation lock is unavailable. */}
      if(version!==generation||!active||document.fullscreenElement!==stage){try{screen.orientation?.unlock?.();}catch{}return;}
      if(version===generation&&active)$('game-display-status').textContent='Full screen opened. You can rotate your phone for a wider view.';
    }catch{if(version===generation&&active)$('game-display-status').textContent='Full screen is unavailable here. You can still play and rotate your phone manually.';}
    finally{fullscreenBusy=false;$('game-fullscreen').disabled=false;}
  });
  // Touch controls emit intentions. The authenticated movement system owns speed,
  // collision, camera-relative axes and persisted positions.
  const stick=$('game-joystick'),thumb=$('game-joystick-thumb'),look=$('game-lookpad');let stickPointer=null,lookPointer=null,stickDirection=null,lookPoint=null;
  const blocked=()=>!active||!!page||!!window.ObjectUI?.active()||!!window.VenueUI?.active();
  function emitDirection(direction){if(stickDirection===direction)return;stickDirection=direction;window.dispatchEvent(new CustomEvent('movement-intent',{detail:{direction}}));}
  function stopTouch(){const previousStick=stickPointer,previousLook=lookPointer;stickPointer=null;lookPointer=null;lookPoint=null;if(previousStick!==null){try{stick.releasePointerCapture?.(previousStick);}catch{}}if(previousLook!==null){try{look.releasePointerCapture?.(previousLook);}catch{}}emitDirection(null);thumb.style.transform='translate(-50%,-50%)';stick.classList.remove('is-active');}
  function updateStick(event){const box=stick.getBoundingClientRect(),radius=Math.min(box.width,box.height)*.36;if(radius<=0)return;let dx=event.clientX-(box.left+box.width/2),dy=event.clientY-(box.top+box.height/2),length=Math.hypot(dx,dy);if(length>radius){dx*=radius/length;dy*=radius/length;}thumb.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;emitDirection(length<radius*.22?null:Math.abs(dy)>=Math.abs(dx)?(dy<0?'forward':'back'):(dx<0?'left':'right'));}
  stick.addEventListener('pointerdown',event=>{if(blocked()||stickPointer!==null||event.button>0)return;event.preventDefault();event.stopPropagation();stickPointer=event.pointerId;try{stick.setPointerCapture?.(event.pointerId);}catch{}stick.classList.add('is-active');updateStick(event);});
  stick.addEventListener('pointermove',event=>{if(event.pointerId!==stickPointer)return;event.preventDefault();if(blocked()){stopTouch();return;}updateStick(event);});
  const finishStick=event=>{if(event.pointerId===stickPointer){event.stopPropagation();stopTouch();}};for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,finishStick);
  look.addEventListener('pointerdown',event=>{if(blocked()||!camera.available||lookPointer!==null||event.button>0)return;event.preventDefault();event.stopPropagation();lookPointer=event.pointerId;lookPoint={x:event.clientX,y:event.clientY};try{look.setPointerCapture?.(event.pointerId);}catch{}});
  look.addEventListener('pointermove',event=>{if(event.pointerId!==lookPointer||!lookPoint)return;event.preventDefault();if(blocked()||!camera.available){stopTouch();return;}const dx=event.clientX-lookPoint.x,dy=event.clientY-lookPoint.y;lookPoint={x:event.clientX,y:event.clientY};if(Number.isFinite(dx)&&Number.isFinite(dy))window.dispatchEvent(new CustomEvent('camera-look',{detail:{yaw:-dx*.006,pitch:-dy*.0045}}));});
  const finishLook=event=>{if(event.pointerId===lookPointer){event.stopPropagation();const previous=lookPointer;lookPointer=null;lookPoint=null;try{look.releasePointerCapture?.(previous);}catch{}}};for(const type of ['pointerup','pointercancel','lostpointercapture'])look.addEventListener(type,finishLook);
  window.addEventListener('game-input-release',stopTouch);
  window.GameUI={render,reset,open,close,blocksMovement:()=>!!page||!!window.ObjectUI?.active()||!!window.VenueUI?.active()};paintCamera();
})();
