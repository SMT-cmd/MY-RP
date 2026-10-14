/* The world stays visible. Panels reuse the authoritative game's existing controls. */
(() => {
  const $ = id => document.getElementById(id), stage = $('game-stage'), drawer = $('game-drawer');
  const pages = new Map([...document.querySelectorAll('[data-game-page]')].map(e => [e.dataset.gamePage, e]));
  const titles = {phone:'Your phone',map:'Places & nearby objects',home:'Your home',furnish:'Furniture & room layout',appearance:'Your wardrobe',work:'Work',learn:'School & careers',people:'People',money:'Wallet & banking',business:'Business & inventory',travel:'Travel & vehicles',health:'Care & coverage',civic:'Your community',activity:'Recent activity',settings:'Settings',help:'How to play'};
  let active = false, page = null, returnFocus = null, actor = null, location = null, rotateDismissed = false, fullscreenBusy = false, generation = 0;
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
    generation++;release();close(false);active=false;actor=null;location=null;stage.hidden=true;portals(false);document.body.classList.remove('is-playing');
    $('game-display-status').textContent='';$('game-name').textContent='';$('game-wallet').textContent='';$('game-connection').textContent='';$('game-activity').textContent='';
    $('world-title').textContent='';$('world-location').textContent='';$('game-context-actions').replaceChildren();$('game-context-label').textContent='';
    $('game-needs').hidden=true;$('game-rotate').hidden=true;stage.classList.remove('game-furnishing');
    for(const meter of stage.querySelectorAll('meter')){meter.value=0;meter.removeAttribute('aria-label');}
    if(document.fullscreenElement===stage){try{screen.orientation?.unlock?.();}catch{}Promise.resolve(document.exitFullscreen?.()).catch(()=>{});}
  }
  function render(view, locked) {
    if(!view?.citizen){if(active)reset();return;}
    if(actor!==view.accountId){if(active)reset();actor=view.accountId;}
    if(!active){active=true;stage.hidden=false;portals(true);document.body.classList.add('is-playing');updateViewport();}
    $('game-name').textContent=view.citizen.name;
    $('game-wallet').textContent=new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(view.balance/100);
    $('game-connection').textContent=window.WorldSync?.ready()===false?'Reconnecting · actions paused':locked?'Action pending · wait for confirmation':'Ready';
    const needs=view.life?.needs;$('game-needs').hidden=!needs;
    if(needs)for(const [name,label] of [['hunger','Food'],['energy','Energy'],['health','Health']]){const m=$('game-'+name);m.value=needs[name];m.setAttribute('aria-label',`${label}: ${needs[name]} of 100`);}
    const world=view.world, pos=world?.position;
    $('game-activity').textContent=world?.trip?.status==='travelling'?'On the road':view.work?.active?'Work in progress':pos?.activity?.kind?({Sit:'Sitting',Rest:'Resting',Read:'Reading',Wash:'Washing',Dress:'At the wardrobe',RequestFoodAssistance:'Getting a meal'}[pos.activity.kind]??'Using an object'):'Tap a door or floor to explore';
    const actions=$('game-context-actions');actions.replaceChildren();
    const sources=[...document.querySelectorAll('#world-interactions button, #travel-actions button')].filter(b=>!b.disabled);
    for(const source of sources.slice(0,3)){const b=document.createElement('button');b.type='button';b.textContent=source.textContent;b.disabled=!!locked;b.addEventListener('click',()=>source.click());actions.append(b);}
    $('game-context-label').textContent=world?.home?'At home':pos?.interior?'Inside':'Nearby';
    $('game-more-actions').textContent=sources.length>3?'More actions':'Places & actions';
    const nextLocation=pos?`${pos.region}:${pos.interior??''}`:null;
    if(location&&nextLocation!==location){
      release();
      const destination={school:'learn',clinic:'health',market:'business',work:'work',terminal:'travel'}[pos?.interior];
      if(destination)open(destination);else if(page)close();
    }
    location=nextLocation;
    // UI-only navigation remains usable while commands await confirmation or reconnect.
    for(const b of stage.querySelectorAll('[data-game-ui]'))b.disabled=b.id==='game-fullscreen'&&fullscreenBusy;
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest?.('[data-game-menu]');if(b)open(b.dataset.gameMenu,b);
  });
  $('game-drawer-close').addEventListener('click',()=>close());
  $('game-back').addEventListener('click',()=>open('phone'));
  $('game-rotate-dismiss').addEventListener('click',()=>{rotateDismissed=true;updateViewport();});
  document.addEventListener('keydown',event=>{if(active&&event.key==='Escape'&&page){event.preventDefault();close();}});
  window.addEventListener('npc-select',()=>open('people'));
  window.addEventListener('furniture-edit',event=>{
    stage.classList.toggle('game-furnishing',!!event.detail);
  });
  const resize=()=>{release();updateViewport();};
  window.addEventListener('resize',resize);window.addEventListener('orientationchange',resize);
  window.visualViewport?.addEventListener('resize',resize);
  window.addEventListener('blur',release);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
  document.addEventListener('fullscreenchange',()=>{resize();$('game-fullscreen').textContent=document.fullscreenElement===stage?'Exit full screen':'Full screen';if(document.fullscreenElement!==stage){$('game-display-status').textContent='';try{screen.orientation?.unlock?.();}catch{}}});
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
  window.GameUI={render,reset,open,close,blocksMovement:()=>!!page};
})();
