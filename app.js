const $=s=>document.querySelector(s);const $$=s=>document.querySelectorAll(s);
const cap={governors:36,parliament:100,gangs:40};
const pay={president:1000,governor:600,parliament:300,police:200,army:250,navy:250,air:250,medical:200,civilian:100,gang:50};
const regionsDefault=["Holden North","Holden South","Holden East","Holden West"];
const basePrices={weapon:[0,500,1500,5000],food:50};
const carPrices={sedan:5000,suv:10000,truck:15000};
function dur(min){return Math.floor((Number(min)||0)*60000*((state&&state.timeScale)||1))}
const storeKey="hcg.state";
function load(){try{const raw=localStorage.getItem(storeKey);if(!raw)return null;return JSON.parse(raw)}catch(e){return null}}
function save(state){localStorage.setItem(storeKey,JSON.stringify(state))}
function initState(){
  const banks={};
  regionsDefault.forEach(r=>banks[r]=50000);
  const majors={};
  regionsDefault.forEach(r=>majors[r]={army:null,navy:null,air:null});
  return{
    players:{},
    current:null,
    regions:[...regionsDefault],
    offices:{president:null,governors:[],parliament:[]},
    command:{chiefs:{army:null,navy:null,air:null},majors},
    security:{police:[],army:[],navy:[],air:[]},
    medical:{general:[],military:[]},
    gangs:[],
    families:[],
    licenses:{gun:[],food:[]},
    shops:{gun:[],food:[],dealer:[],fuel:[]},
    licenseApplications:[],
    chats:{general:[],command:[],family:{},gang:{}},
    parties:[],
    black:{shops:[]},
    justice:{prisons:{},bail:{},trials:[],cases:[]},
    timers:[],
    autoElections:{enabled:false,termMin:60,openDurMin:10,nextOpenTs:null,closeTs:null},
    air:{prices:{},seats:{}},
    production:{cars:{sedan:50,suv:30,truck:20}},
    properties:{lands:[],houses:[]},
    specialDeals:[],
    durations:{prisonMin:30,trialMin:30,travelMin:30,carDeliveryMin:30},
    timeScale:1,
    testing:true,
    elections:{open:false,candidates:{president:[],governor:[],parliament:[]},votes:{president:{},governor:{},parliament:{}}},
    riots:[],
    kidnappings:[],
    banking:{staff:{},}, 
    treasury:{government:100000,banks:banks},
    log:[],
    hospitals:{generalQueue:[],militaryQueue:[]}
  }
}
let state=load()||initState();
function ensurePlayer(name){
  if(!state.players[name])state.players[name]={
    name,role:"civilian",
    money:0,bankBalance:0,
    guild:null,family:null,
    security:null,medical:null,government:null,
    stateRegion:null,
    weaponLevel:0,
    energy:100,
    age:null,
    gender:null,
    marriedTo:null,
    sexCount:0,
    fertilityBoost:0,
    level:1,
    xp:0,
    party:null,
    cars:[],
    served:{president:0,governor:0,parliament:0}
  }
}
function setCurrent(name){ensurePlayer(name);state.current=name;save(state);syncHeader();refreshAll()}
function curr(){return state.players[state.current]||null}
function log(t){state.log.push({t,ts:Date.now()});if(state.log.length>400)state.log.shift();save(state);renderLogs()}
function syncHeader(){const p=curr();$("#playerName").textContent=p?`👤 ${p.name}`:"";$("#playerRole").textContent=p?`🎭 ${formatRole(p)} L${p.level||1}`:"";$("#playerMoney").textContent=p?`💰 ${p.money.toFixed(0)}`:""}
function formatRole(p){if(p.government==="president")return "President";if(p.government==="governor")return "Governor";if(p.government==="parliament")return "Parliament";if(p.security==="police")return "Police";if(p.security==="army")return "Army";if(p.security==="navy")return "Navy";if(p.security==="air")return "Air Force";if(p.medical==="general")return "Hospital";if(p.medical==="military")return "Military Hospital";if(p.guild)return `Gang: ${p.guild}`;return "Civilian"}
function inArr(arr,name){return arr.includes(name)}
function pushUnique(arr,name){if(!arr.includes(name))arr.push(name)}
function remove(arr,name){const i=arr.indexOf(name);if(i>=0)arr.splice(i,1)}
function statusText(){const pres=state.offices.president?`1/1 (${state.offices.president})`:"0/1 (vacant)";const gov=`${state.offices.governors.length}/${cap.governors}`;const par=`${state.offices.parliament.length}/${cap.parliament}`;$("#presidentStatus").textContent=pres;$("#governorStatus").textContent=gov;$("#parliamentStatus").textContent=par;$("#policeStatus").textContent=`${state.security.police.length}`;$("#armyStatus").textContent=`${state.security.army.length}`;$("#navyStatus").textContent=`${state.security.navy.length}`;$("#airStatus").textContent=`${state.security.air.length}`;$("#medicalStatus").textContent=`Gen:${state.medical.general.length} Mil:${state.medical.military.length}`;$("#gangStatus").textContent=`Gangs ${state.gangs.length}/${cap.gangs}`;$("#familyStatus").textContent=`Families ${state.families.length}`}
function statusEconomy(){
  $("#govTreasury")&&($("#govTreasury").textContent=state.treasury.government.toFixed(0));
  if($("#banksStatus")){
    const bits=state.regions.map(r=>`${r}:${state.treasury.banks[r].toFixed(0)}`);
    $("#banksStatus").textContent=bits.join(" | ");
  }
  const g=curr()&&curr().guild?state.gangs.find(x=>x.name===curr().guild):null;
  $("#gangTreasury")&&($("#gangTreasury").textContent=g?g.treasury.toFixed(0):"N/A");
  if($("#statEnergy"))$("#statEnergy").textContent=curr()?curr().energy:0;
  if($("#statWeapon"))$("#statWeapon").textContent=curr()?curr().weaponLevel:0;
  if($("#chiefsStatus")){
    const c=state.command.chiefs;
    $("#chiefsStatus").textContent=`Army:${c.army||"-"} Navy:${c.navy||"-"} Air:${c.air||"-"}`;
  }
  if($("#majorsStatus")){
    const lines=state.regions.map(r=>{
      const m=state.command.majors[r];
      return `${r} — A:${m.army||"-"} N:${m.navy||"-"} AF:${m.air||"-"}`
    });
    $("#majorsStatus").textContent=lines.join(" | ");
  }
  if($("#partyStatus")){const p=curr();const pa=p&&p.party?(state.parties||[]).find(x=>x.name===p.party):null;const txt=pa?`${pa.name} • Treasury ${pa.treasury}`:"No party";$("#partyStatus").textContent=txt}
  if($("#wholesaleStatus")){const gStock=state.shops.gun.reduce((a,b)=>a+(b.stock||0),0);const fStock=state.shops.food.reduce((a,b)=>a+(b.stock||0),0);$("#wholesaleStatus").textContent=`Gun stock:${gStock} Food stock:${fStock}`}
  if($("#autoElStatus")){const a=state.autoElections;const nxt=a.nextOpenTs?new Date(a.nextOpenTs).toLocaleTimeString():"-";$("#autoElStatus").textContent=`Enabled:${a.enabled} Term:${a.termMin}m Open:${a.openDurMin}m Next:${nxt}`}
  if($("#timersLog")){const now=Date.now();const lines=state.timers.map(t=>`${t.type} • ${t.player} • ${Math.max(0,Math.ceil((t.endTs-now)/60000))}m`);$("#timersLog").textContent=lines.join("\n")}
  if($("#mapStatus")){const lines=[];state.regions.forEach(r=>{const gs=state.shops.gun.filter(s=>s.region===r).length;const fs=state.shops.food.filter(s=>s.region===r).length;const ds=(state.shops.dealer||[]).filter(s=>s.region===r).length;lines.push(`${r}: Gun:${gs} Food:${fs} Dealer:${ds}`)});$("#mapStatus").textContent=lines.join("\n")}
}
function refreshSelectors(){
  const ids=["selectState","selectRiotState","selectGunState","selectFoodState","selectBankState","selectDealerRegion","selectPropState"];
  ids.forEach(id=>{
    const el=$("#"+id); if(!el) return;
    el.innerHTML="";
    state.regions.forEach(r=>{const o=document.createElement("option");o.value=r;o.textContent=r;el.appendChild(o)});
  });
  const gunSel=$("#selectGunStore"); if(gunSel){gunSel.innerHTML=""; state.shops.gun.forEach(s=>{const o=document.createElement("option");o.value=s.id;o.textContent=`${s.owner}@${s.region} x${s.markup}`;gunSel.appendChild(o)})}
  const foodSel=$("#selectFoodStore"); if(foodSel){foodSel.innerHTML=""; state.shops.food.forEach(s=>{const o=document.createElement("option");o.value=s.id;o.textContent=`${s.owner}@${s.region} x${s.markup}`;foodSel.appendChild(o)})}
  const bmgSel=$("#selectBMShop"); if(bmgSel){bmgSel.innerHTML=""; state.black&&state.black.shops&&state.black.shops.forEach(s=>{const o=document.createElement("option");o.value=s.id;o.textContent=`BM ${s.type}@${s.region} x${s.markup}`;bmgSel.appendChild(o)})}
  const qSel=$("#selectQuickPlayer"); if(qSel){qSel.innerHTML=""; Object.keys(state.players).forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=n;qSel.appendChild(o)})}
  const wGunSel=$("#selectWholesaleGun"); if(wGunSel){wGunSel.innerHTML=""; state.shops.gun.forEach(s=>{const o=document.createElement("option");o.value=s.id;o.textContent=`${s.owner}@${s.region} stock:${s.stock||0}`;wGunSel.appendChild(o)})}
  const wFoodSel=$("#selectWholesaleFood"); if(wFoodSel){wFoodSel.innerHTML=""; state.shops.food.forEach(s=>{const o=document.createElement("option");o.value=s.id;o.textContent=`${s.owner}@${s.region} stock:${s.stock||0}`;wFoodSel.appendChild(o)})}
  const partySel=$("#selectParty"); if(partySel){partySel.innerHTML=""; (state.parties||[]).forEach(pa=>{const o=document.createElement("option");o.value=pa.name;o.textContent=`${pa.name} ${pa.treasury}`;partySel.appendChild(o)})}
  const dest=$("#selectTravelDest"); if(dest){dest.innerHTML=""; state.regions.forEach(r=>{const o=document.createElement("option");o.value=r;o.textContent=r;dest.appendChild(o)})}
  const bmState=$("#selectBMState"); if(bmState){bmState.innerHTML=""; state.regions.forEach(r=>{const o=document.createElement("option");o.value=r;o.textContent=r;bmState.appendChild(o)})}
  const dealSel=$("#selectDealer"); if(dealSel){dealSel.innerHTML=""; state.shops.dealer&&state.shops.dealer.forEach(d=>{const o=document.createElement("option");o.value=d.id;o.textContent=`Dealer ${d.owner}@${d.region}`;dealSel.appendChild(o)})}
  const dealBuySel=$("#selectDealerBuy"); if(dealBuySel){dealBuySel.innerHTML=""; state.shops.dealer&&state.shops.dealer.forEach(d=>{const o=document.createElement("option");o.value=d.id;o.textContent=`Dealer ${d.owner}@${d.region}`;dealBuySel.appendChild(o)})}
}
function refreshGangFamilySelectors(){const gSel=$("#selectGang");gSel.innerHTML="";state.gangs.forEach(g=>{const o=document.createElement("option");o.value=g.name;o.textContent=`${g.name} (${g.members.length})`;gSel.appendChild(o)});const fSel=$("#selectFamily");fSel.innerHTML="";state.families.forEach(f=>{const o=document.createElement("option");o.value=f.name;o.textContent=`${f.name} (${f.members.length})`;fSel.appendChild(o)})}
function refreshGangMembersSelector(){const p=curr();const sel=$("#selectGangMember");if(!sel||!p||!p.guild){if(sel)sel.innerHTML="";return}sel.innerHTML="";const g=state.gangs.find(x=>x.name===p.guild);g.members.forEach(m=>{const o=document.createElement("option");o.value=m;o.textContent=m;sel.appendChild(o)})}
function refreshHospitals(){const gen=$("#listGeneral");const mil=$("#listMilitary");gen.innerHTML="";mil.innerHTML="";state.hospitals.generalQueue.forEach(x=>{const li=document.createElement("li");li.textContent=`${x.name} • ${x.reason}`;gen.appendChild(li)});state.hospitals.militaryQueue.forEach(x=>{const li=document.createElement("li");li.textContent=`${x.name} • ${x.reason}`;mil.appendChild(li)})}
function renderLogs(){const a=$("#actionLog");a.textContent=state.log.slice(-50).map(x=>new Date(x.ts).toLocaleTimeString()+" — "+x.t).join("\n");const e=$("#electionLog");const ev=state.elections;const lines=[];lines.push(`Open: ${ev.open}`);["president","governor","parliament"].forEach(o=>{lines.push(`${o} candidates: ${ev.candidates[o].join(", ")||"-"}`);const v=ev.votes[o];const sums=Object.keys(v).map(k=>`${k}:${v[k]}`);lines.push(`${o} votes: ${sums.join(", ")||"-"}`)});e.textContent=lines.join("\n")}
function refreshAll(){statusText();refreshGangFamilySelectors();refreshHospitals();renderLogs();syncHeader()}
function refreshAllPlus(){refreshAll();statusEconomy();refreshSelectors();if($("#shopStatus"))$("#shopStatus").textContent=`Gun stores:${state.shops.gun.length} • Food stores:${state.shops.food.length}`}
function refreshChats(){const p=curr();const g=p&&p.guild?p.guild:null;const f=p&&p.family?p.family:null;const cg=state.chats.general.map(x=>`${x.ts}|${x.from}: ${x.msg}`).join("\n");$("#chatGeneral")&&($("#chatGeneral").textContent=cg);const cf=f&&(state.chats.family[f]||[]).map(x=>`${x.ts}|${x.from}: ${x.msg}`).join("\n");$("#chatFamily")&&($("#chatFamily").textContent=cf||"");const cga=g&&(state.chats.gang[g]||[]).map(x=>`${x.ts}|${x.from}: ${x.msg}`).join("\n");$("#chatGang")&&($("#chatGang").textContent=cga||"");const cc=state.chats.command.map(x=>`${x.ts}|${x.from}: ${x.msg}`).join("\n");$("#chatCommand")&&($("#chatCommand").textContent=cc)}
function refreshApps(){const lines=state.licenseApplications.map(a=>`${a.id} ${a.type} by ${a.applicant} [${a.status}]`);$("#appsLog")&&($("#appsLog").textContent=lines.join("\n"))}
function refreshFamilyInfo(){const p=curr();if(!p)return;const spouse=p.marriedTo||"-";$("#familyInfo")&&($("#familyInfo").textContent=`Spouse: ${spouse} • Sex: ${p.sexCount} • Boost: ${p.fertilityBoost}`)}
function salaryTick(){const p=curr();if(!p)return;let role="civilian";if(p.government==="president")role="president";else if(p.government==="governor")role="governor";else if(p.government==="parliament")role="parliament";else if(p.security==="police")role="police";else if(p.security==="army")role="army";else if(p.security==="navy")role="navy";else if(p.security==="air")role="air";else if(p.medical==="general"||p.medical==="military")role="medical";else if(p.guild)role="gang";p.money+=pay[role];save(state);syncHeader();log(`Salary +${pay[role]} for ${p.name} (${role})`)}
function energyUse(p,amount=5){p.energy=Math.max(0,Math.min(100,p.energy-amount))}
function energyGain(p,amount=20){p.energy=Math.max(0,Math.min(100,p.energy+amount))}
function addToHospital(name,reason,military){const rec={name,reason};if(military)state.hospitals.militaryQueue.push(rec);else state.hospitals.generalQueue.push(rec);save(state);refreshHospitals()}
function treatHospitals(){if(state.hospitals.generalQueue.length){const x=state.hospitals.generalQueue.shift();log(`General hospital treated ${x.name} for ${x.reason}`)}if(state.hospitals.militaryQueue.length){const x=state.hospitals.militaryQueue.shift();log(`Military hospital treated ${x.name} for ${x.reason}`)}save(state);refreshHospitals()}
function work(){const p=curr();if(!p)return;let amt=50;if(p.guild)amt=80;if(p.security)amt=60;p.money+=amt;save(state);syncHeader();log(`${p.name} worked and earned ${amt}`)}
function work2(){const p=curr();if(!p)return;let amt=50;if(p.guild)amt=80;if(p.security)amt=60;if(p.energy<30)amt=Math.floor(amt*0.5);p.money+=amt;energyUse(p,5);save(state);syncHeader();statusEconomy();log(`${p.name} worked and earned ${amt} (energy ${p.energy})`)}
function canCreateGang(){return state.gangs.length<cap.gangs}
function createGang(name){if(!name)return false;if(!canCreateGang())return false;if(state.gangs.find(g=>g.name.toLowerCase()===name.toLowerCase()))return false;const region=curr()&&curr().stateRegion?curr().stateRegion:state.regions[0];state.gangs.push({name,members:[],region,treasury:0});save(state);refreshGangFamilySelectors();statusText();statusEconomy();log(`Gang created: ${name} in ${region}`);return true}
function ensureGangStructures(){state.gangs.forEach(g=>{if(!g.ranks)g.ranks={};if(!g.leader&&g.members.length)g.leader=g.members[0]})}
function setGangRank(actor,member,rank){const p=state.players[actor];if(!p||!p.guild)return false;const g=state.gangs.find(x=>x.name===p.guild);if(!g)return false;const isBoss=(g.leader===actor)||(g.ranks[actor]==="underboss");if(!isBoss)return false;g.ranks[member]=rank;save(state);refreshGangMembersSelector();log(`${actor} set ${member} to ${rank} in ${g.name}`);return true}
function joinGang(name,player){const g=state.gangs.find(x=>x.name===name);if(!g)return false;pushUnique(g.members,player);state.players[player].guild=g.name;save(state);refreshGangFamilySelectors();syncHeader();log(`${player} joined gang ${g.name}`);return true}
function createFamily(name){if(!name)return false;if(state.families.find(f=>f.name.toLowerCase()===name.toLowerCase()))return false;state.families.push({name,members:[]});save(state);refreshGangFamilySelectors();statusText();log(`Family created: ${name}`);return true}
function joinFamily(name,player){const f=state.families.find(x=>x.name===name);if(!f)return false;pushUnique(f.members,player);state.players[player].family=f.name;save(state);refreshGangFamilySelectors();syncHeader();log(`${player} joined family ${f.name}`);return true}
function claimPresident(player){if(state.offices.president)return false;state.offices.president=player;const p=state.players[player];p.government="president";save(state);statusText();syncHeader();log(`${player} became President`);return true}
function becomeGovernor(player){const p=state.players[player];if(!canJoinFaction(p) && state.governorGate)return false;if(state.offices.governors.length>=cap.governors)return false;pushUnique(state.offices.governors,player);p.government="governor";save(state);statusText();syncHeader();log(`${player} joined as Governor`);return true}
function joinParliament(player){const p=state.players[player];if(!canJoinFaction(p) && state.parliamentGate)return false;if(state.offices.parliament.length>=cap.parliament)return false;pushUnique(state.offices.parliament,player);p.government="parliament";save(state);statusText();syncHeader();log(`${player} joined Parliament`);return true}
function joinSecurity(branch,player){const p=state.players[player];if(!canJoinFaction(p) && state.securityGate)return false;pushUnique(state.security[branch],player);p.security=branch;save(state);statusText();syncHeader();log(`${player} joined ${branch}`);return true}
function joinMedical(type,player){const p=state.players[player];if(!canJoinFaction(p) && state.medicalGate)return false;pushUnique(state.medical[type],player);p.medical=type;save(state);statusText();syncHeader();log(`${player} joined ${type==="general"?"Hospital":"Military Hospital"}`);return true}
function createRiot(player){const p=state.players[player];if(!p.guild)return false;const id=Math.random().toString(36).slice(2,8);const sev=Math.floor(Math.random()*5)+1;state.riots.push({id,by:p.guild,sev,active:true});save(state);log(`${player} created riot (${id}) severity ${sev}`);return true}
function createRiotAdv(player,region,sev,funding){
  const p=state.players[player]; if(!p.guild)return false;
  const cost=sev*1000;
  if(funding==="gov"){ if(state.treasury.government<cost) return false; state.treasury.government-=cost; }
  else if(funding==="party"){ const pa=p.party?(state.parties||[]).find(x=>x.name===p.party):null; if(!pa||pa.treasury<cost) return false; pa.treasury-=cost; }
  else { const g=state.gangs.find(x=>x.name===p.guild); if(!g||g.treasury<cost) return false; g.treasury-=cost; }
  const id=Math.random().toString(36).slice(2,8);
  state.riots.push({id,by:p.guild,sev,region,active:true});
  save(state); statusEconomy(); log(`${player} created riot ${id} sev ${sev} in ${region} funded by ${funding}`); return true;
}
function dispatchForces(player){if(state.offices.president!==player)return false;if(!state.riots.find(r=>r.active))return false;const riot=state.riots.find(r=>r.active);const pick=["police","army","navy","air"][Math.floor(Math.random()*4)];const force=state.security[pick].length;let effect=Math.min(riot.sev,Math.max(1,Math.floor(force/3)));riot.sev-=effect;if(riot.sev<=0){riot.active=false;log(`Forces (${pick}) resolved riot ${riot.id}`)}else{log(`Forces (${pick}) reduced riot ${riot.id} to ${riot.sev}`)}const civCas=Math.floor(Math.random()*3);const milCas=Math.floor(Math.random()*2);for(let i=0;i<civCas;i++)addToHospital("Civilian","Riot injury",false);for(let i=0;i<milCas;i++)addToHospital("Soldier","Riot injury",true);save(state);return true}
function chiefBonus(branch){const c=state.command.chiefs[branch];return c?1:0}
function majorBonus(branch,region){const m=state.command.majors[region]?state.command.majors[region][branch]:null;return m?1:0}
function resolveOnRiot(riot,branch,level){const force=state.security[branch].length;const effect=Math.min(riot.sev, Math.max(1, Math.floor(force/3)+level)); riot.sev-=effect; const civCas=Math.floor(Math.random()*2); const milCas=Math.floor(Math.random()*2); for(let i=0;i<civCas;i++)addToHospital("Civilian","Riot injury",false); for(let i=0;i<milCas;i++)addToHospital("Soldier","Riot injury",true); if(riot.sev<=0){riot.active=false;log(`Forces (${branch}) resolved riot ${riot.id}`)}else{log(`Forces (${branch}) reduced riot ${riot.id} to ${riot.sev}`)}}
function dispatchPresident(player,branch,riotId){ if(state.offices.president!==player)return false; const riot=state.riots.find(r=>r.active && r.id===riotId); if(!riot)return false; resolveOnRiot(riot,branch,chiefBonus(branch)); save(state); return true; }
function dispatchGovernor(player,branch,riotId){ const p=state.players[player]; if(p.government!=="governor")return false; const riot=state.riots.find(r=>r.active && r.id===riotId && r.region===p.stateRegion); if(!riot)return false; resolveOnRiot(riot,branch,majorBonus(branch,p.stateRegion)); save(state); return true; }
function kidnap(player){const p=state.players[player];if(!p.guild)return false;const pool=Object.values(state.players).filter(x=>x.family&&!x.guild);if(!pool.length)return false;const v=pool[Math.floor(Math.random()*pool.length)];const id=Math.random().toString(36).slice(2,8);state.kidnappings.push({id,victim:v.name,by:p.guild,active:true});save(state);log(`${player} kidnapped ${v.name}`);return true}
function rescue(player){const p=state.players[player];const fam=p.family?state.families.find(f=>f.name===p.family):null;const can=p.security||fam;const k=state.kidnappings.find(x=>x.active);if(!can||!k)return false;k.active=false;log(`${p.name} rescued ${k.victim} from ${k.by}`);return true}
function electionsOpen(){state.elections.open=true;save(state);log("Elections opened")}
function electionsClose(){state.elections.open=false;resolveElections();save(state);log("Elections closed and resolved")}
function registerCandidate(player,office){if(!state.elections.open)return false;if(!["president","governor","parliament"].includes(office))return false;pushUnique(state.elections.candidates[office],player);save(state);log(`${player} registered for ${office}`);return true}
function castVote(voter,office,forName){if(!state.elections.open)return false;if(!state.elections.candidates[office].includes(forName))return false;const bucket=state.elections.votes[office];bucket[forName]=(bucket[forName]||0)+1;save(state);log(`${voter} voted ${forName} for ${office}`);return true}
function resolveElections(){const res=(office,slots)=>{const votes=state.elections.votes[office];const entries=Object.entries(votes).map(([name,count])=>{const pl=state.players[name];let inf=0;if(pl&&pl.party){const pa=state.parties.find(p=>p.name===pl.party);if(pa)inf=pa.influence||0}const weighted=count*(1+inf*0.1);return {name,weighted}}).sort((a,b)=>b.weighted-a.weighted).map(x=>x.name);const winners=[];entries.forEach(w=>{const pl=state.players[w];if(!pl)return;if(pl.served&&pl.served[office]>=1)return;if(winners.length<slots)winners.push(w)});if(office==="president"){state.offices.president=null;winners.slice(0,1).forEach(w=>{claimPresident(w);state.players[w].served.president+=1})}else if(office==="governor"){state.offices.governors=[];winners.forEach(w=>{becomeGovernor(w);state.players[w].served.governor+=1})}else if(office==="parliament"){state.offices.parliament=[];winners.forEach(w=>{joinParliament(w);state.players[w].served.parliament+=1})}};res("president",1);res("governor",cap.governors);res("parliament",cap.parliament);state.elections={open:false,candidates:{president:[],governor:[],parliament:[]},votes:{president:{},governor:{},parliament:{}}}}
function bind(){const tabs=$$(".tab");tabs.forEach(b=>b.addEventListener("click",e=>{tabs.forEach(t=>t.classList.remove("active"));e.currentTarget.classList.add("active");const k=e.currentTarget.dataset.tab;$$(".tabpane").forEach(p=>p.classList.remove("active"));$("#tab-"+k).classList.add("active")}));$("#btnRegister").addEventListener("click",()=>{const n=$("#inputName").value.trim();if(!n)return;setCurrent(n);log(`Active player: ${n}`)});$("#btnBecomePresident").addEventListener("click",()=>{const p=curr();if(!p)return;if(claimPresident(p.name)){}else log("Presidency already taken")});$("#btnBecomeGovernor").addEventListener("click",()=>{const p=curr();if(!p)return;if(!becomeGovernor(p.name))log("Governor slots full")});$("#btnJoinParliament").addEventListener("click",()=>{const p=curr();if(!p)return;if(!joinParliament(p.name))log("Parliament full")});$("#btnJoinPolice").addEventListener("click",()=>{const p=curr();if(!p)return;joinSecurity("police",p.name)});$("#btnJoinArmy").addEventListener("click",()=>{const p=curr();if(!p)return;joinSecurity("army",p.name)});$("#btnJoinNavy").addEventListener("click",()=>{const p=curr();if(!p)return;joinSecurity("navy",p.name)});$("#btnJoinAir").addEventListener("click",()=>{const p=curr();if(!p)return;joinSecurity("air",p.name)});$("#btnJoinMedical").addEventListener("click",()=>{const p=curr();if(!p)return;joinMedical("general",p.name)});$("#btnJoinMilMedical").addEventListener("click",()=>{const p=curr();if(!p)return;joinMedical("military",p.name)});$("#btnCreateGang").addEventListener("click",()=>{const n=$("#inputGangName").value.trim();if(!n)return;if(!createGang(n))log("Cannot create gang")});$("#btnJoinGang").addEventListener("click",()=>{const p=curr();if(!p)return;const n=$("#selectGang").value;if(!n)return;joinGang(n,p.name)});$("#btnCreateFamily").addEventListener("click",()=>{const n=$("#inputFamilyName").value.trim();if(!n)return;if(!createFamily(n))log("Cannot create family")});$("#btnJoinFamily").addEventListener("click",()=>{const p=curr();if(!p)return;const n=$("#selectFamily").value;if(!n)return;joinFamily(n,p.name)});$("#btnWork").addEventListener("click",()=>{work()});$("#btnCreateRiot").addEventListener("click",()=>{const p=curr();if(!p)return;if(!createRiot(p.name))log("Only gang members can create riots")});$("#btnDispatchForces").addEventListener("click",()=>{const p=curr();if(!p)return;if(!dispatchForces(p.name))log("Only president can dispatch or no active riot")});$("#btnKidnap").addEventListener("click",()=>{const p=curr();if(!p)return;if(!kidnap(p.name))log("Kidnap failed")});$("#btnRescue").addEventListener("click",()=>{const p=curr();if(!p)return;if(!rescue(p.name))log("Rescue failed")});$("#btnOpenElections").addEventListener("click",()=>{electionsOpen()});$("#btnCloseElections").addEventListener("click",()=>{electionsClose()});$("#btnRegisterCandidate").addEventListener("click",()=>{const p=curr();if(!p)return;const o=$("#inputCandidateOffice").value.trim().toLowerCase();if(!registerCandidate(p.name,o))log("Candidate registration failed")});$("#btnCastVote").addEventListener("click",()=>{const p=curr();if(!p)return;const o=$("#inputVoteOffice").value.trim().toLowerCase();const f=$("#inputVoteFor").value.trim();if(!castVote(p.name,o,f))log("Vote failed")})}
function strengthFromWeapons(names){let s=0;names.forEach(n=>{const pl=state.players[n];if(!pl)return;const lvl=pl.weaponLevel||0; if(lvl===1)s+=1; if(lvl===2)s+=3; if(lvl===3)s+=6;});return s}
function totalStrength(list){return list.length + strengthFromWeapons(list)}
function ensureBankStaffRegion(r){if(!state.banking.staff[r])state.banking.staff[r]=[]}
function setPlayerStateRegion(name,region){const p=state.players[name];p.stateRegion=region;save(state);statusEconomy();refreshSelectors();log(`${name} set state to ${region}`)}
function appointChief(branch,name){const c=curr();if(!c||c.government!=="president")return false;state.command.chiefs[branch]=name;save(state);statusEconomy();log(`Appointed ${name} as Chief of ${branch}`);return true}
function appointMajor(branch,name,region){const c=curr();if(!c||c.government!=="governor")return false;state.command.majors[region][branch]=name;save(state);statusEconomy();log(`Appointed ${name} as ${branch} Major for ${region}`);return true}
function joinBankStaff(player){const p=state.players[player];const r=p.stateRegion||state.regions[0];ensureBankStaffRegion(r);pushUnique(state.banking.staff[r],player);save(state);statusEconomy();log(`${player} joined bank staff in ${r}`)}
function deposit(player,amt){const p=state.players[player];amt=Number(amt)||0;if(amt<=0||p.money<amt)return false;p.money-=amt;p.bankBalance+=amt;state.treasury.banks[p.stateRegion||state.regions[0]]+=amt;save(state);statusEconomy();syncHeader();log(`${player} deposited ${amt}`);return true}
function withdraw(player,amt){const p=state.players[player];amt=Number(amt)||0;if(amt<=0||p.bankBalance<amt)return false;p.bankBalance-=amt;p.money+=amt;state.treasury.banks[p.stateRegion||state.regions[0]]-=Math.min(state.treasury.banks[p.stateRegion||state.regions[0]],amt);save(state);statusEconomy();syncHeader();log(`${player} withdrew ${amt}`);return true}
function gangStrength(gang){const g=state.gangs.find(x=>x.name===gang);if(!g)return 0;return totalStrength(g.members)}
function policeStrength(){return totalStrength(state.security.police)}
function robBank(player,region){const p=state.players[player];if(!p.guild)return false;const g=gangStrength(p.guild);const pol=policeStrength();const bank=state.treasury.banks[region];if(bank<=0)return false;if(g>pol){const take=Math.min(bank, 5000+Math.floor(Math.random()*5000));state.treasury.banks[region]-=take;const gg=state.gangs.find(x=>x.name===p.guild);gg.treasury=(gg.treasury||0)+take;log(`${p.name}'s gang robbed ${region} bank for ${take}`)}else{addToHospital(p.name,"Robbery injury",false);log(`Robbery failed; police repelled the gang`) } save(state);statusEconomy();return true}
function canJoinFaction(p){return state.testing || (p.level||1)>=5}
function createDealer(owner,region,markup){const id="dealer-"+Math.random().toString(36).slice(2,6);state.shops.dealer.push({id,owner,region,markup:Number(markup)||1.2,stock:{sedan:0,suv:0,truck:0}});save(state);refreshSelectors();statusEconomy();log(`${owner} created dealer in ${region}`);return true}
function wholesaleDealer(dealerId,model,qty){const d=state.shops.dealer.find(x=>x.id===dealerId);if(!d)return false;qty=Number(qty)||0;if(qty<=0)return false;const cap=state.production.cars[model]||0;if(cap<qty)return false;state.production.cars[model]-=qty;d.stock[model]+=qty;state.treasury.government+=qty*carPrices[model]*0.5;save(state);statusEconomy();refreshSelectors();log(`Dealer ${d.owner} stocked ${qty} ${model}`);return true}
function buyFromDealer(player,dealerId,model){const p=state.players[player];const d=state.shops.dealer.find(x=>x.id===dealerId);if(!p||!d)return false;if(d.stock[model]<=0)return false;const price=carPrices[model]*d.markup;if(p.money<price)return false;p.money-=price;d.stock[model]-=1;const end=Date.now()+dur(state.durations.carDeliveryMin);state.timers.push({type:"car",player,model,endTs:end});const owner=state.players[d.owner];if(owner)owner.money+=price*0.9;state.treasury.government+=price*0.1;save(state);syncHeader();statusEconomy();refreshSelectors();log(`${player} bought ${model} from ${d.owner} delivery in ${state.durations.carDeliveryMin}m`);return true}
function refuelCar(player,liters){const p=state.players[player];liters=Number(liters)||10;if(!p||!(p.cars&&p.cars.length))return false;const cost=liters*(basePrices.fuel||5);if(p.money<cost)return false;p.money-=cost;const car=p.cars[p.cars.length-1];if(typeof car==="string"){p.cars[p.cars.length-1]={model:car,fuel:0}}const c=p.cars[p.cars.length-1];c.fuel=(c.fuel||0)+liters;save(state);syncHeader();statusEconomy();log(`${player} refueled ${liters}L`);return true}
function drive(player,dest){const p=state.players[player];if(!p||!(p.cars&&p.cars.length))return false;const car=p.cars[p.cars.length-1];const c=typeof car==="string"?{model:car,fuel:0}:car;if(typeof car==="string")p.cars[p.cars.length-1]=c;const from=p.stateRegion||state.regions[0];const i1=state.regions.indexOf(from),i2=state.regions.indexOf(dest);if(i2<0)return false;const dist=Math.abs(i1-i2)||1;const need=dist*10;if((c.fuel||0)<need)return false;c.fuel-=need;const end=Date.now()+dur(state.durations.travelMin*dist);state.timers.push({type:"drive",player,dest,endTs:end});save(state);statusEconomy();log(`${player} driving to ${dest}; arrival in ${state.durations.travelMin*dist}m`);return true}
function setAirRoute(dest,price,seats){state.air.prices[dest]=Number(price)||0;state.air.seats[dest]=Number(seats)||0;save(state);statusEconomy();log(`Air route set ${dest} price ${price} seats ${seats}`);return true}
function buyTicket(player,dest){const p=state.players[player];const price=state.air.prices[dest]||0;const seats=state.air.seats[dest]||0;if(!p||seats<=0||p.money<price)return false;p.money-=price;state.air.seats[dest]=seats-1;const end=Date.now()+dur(state.durations.travelMin);state.timers.push({type:"travel",player,dest,endTs:end});save(state);syncHeader();statusEconomy();log(`${player} bought ticket to ${dest}`);return true}
function setDurations(ts,pr,tri,tr,del){state.timeScale=Number(ts)||state.timeScale;state.durations.prisonMin=Number(pr)||state.durations.prisonMin;state.durations.trialMin=Number(tri)||state.durations.trialMin;state.durations.travelMin=Number(tr)||state.durations.travelMin;state.durations.carDeliveryMin=Number(del)||state.durations.carDeliveryMin;save(state);statusEconomy();log("Durations/timeScale updated");return true}
function createLand(actor,region,price){const a=state.players[actor];if(!a||!(a.government||a.security))return false;const id="land-"+Math.random().toString(36).slice(2,6);state.properties.lands.push({id,region,price:Number(price)||10000,owner:null});save(state);statusEconomy();log(`Land listed in ${region} for ${price}`);return true}
function buyLand(player,id){const p=state.players[player];const land=state.properties.lands.find(x=>x.id===id&&x.owner===null);if(!p||!land||p.money<land.price)return false;p.money-=land.price;land.owner=player;save(state);syncHeader();statusEconomy();log(`${player} bought land ${id}`);return true}
function buildHouse(player,id){const land=state.properties.lands.find(x=>x.id===id&&x.owner===player);if(!land)return false;const hid="house-"+Math.random().toString(36).slice(2,6);state.properties.houses.push({id:hid,region:land.region,owner:player,value:land.price*1.5});save(state);statusEconomy();log(`${player} built house ${hid} on ${id}`);return true}
function sellProperty(player,id){let land=state.properties.lands.find(x=>x.id===id&&x.owner===player);if(land){state.properties.lands=state.properties.lands.filter(x=>x.id!==id);state.players[player].money+=land.price;save(state);syncHeader();statusEconomy();log(`${player} sold land ${id}`);return true}let house=state.properties.houses.find(x=>x.id===id&&x.owner===player);if(house){state.properties.houses=state.properties.houses.filter(x=>x.id!==id);state.players[player].money+=house.value;save(state);syncHeader();statusEconomy();log(`${player} sold house ${id}`);return true}return false}
function createCase(officer,suspect,charge,evidence){const o=state.players[officer];const s=state.players[suspect];if(!o||!o.security||!s)return false;const id="case-"+Math.random().toString(36).slice(2,6);state.justice.cases.push({id,officer,suspect,charges:charge?[charge]:[],evidence:evidence?[evidence]:[],status:"custody",verdict:null});save(state);log(`Case ${id} opened vs ${suspect}`);return true}
function addCaseCharge(id,charge){const c=state.justice.cases.find(x=>x.id===id);if(!c)return false;c.charges.push(charge);save(state);log(`Case ${id} charge added`);return true}
function addCaseEvidence(id,ev){const c=state.justice.cases.find(x=>x.id===id);if(!c)return false;c.evidence.push(ev);save(state);log(`Case ${id} evidence added`);return true}
function scheduleCaseTrial(actor,id){const a=state.players[actor];if(!a||(a.security==null&&a.government==null))return false;const c=state.justice.cases.find(x=>x.id===id);if(!c)return false;c.status="trial";const end=Date.now()+dur(state.durations.trialMin);state.justice.trials.push({target:c.suspect,endTs:end,caseId:id});state.timers.push({type:"trial",player:c.suspect,caseId:id,endTs:end});save(state);statusEconomy();log(`Case ${id} trial scheduled`);return true}
function grantLicense(type,target){const c=curr();if(!c||!(c.government==="president"||c.government==="governor"))return false;pushUnique(state.licenses[type],target);save(state);log(`Granted ${type} license to ${target}`);return true}
function createGunStore(owner,region,markup){if(!state.licenses.gun.includes(owner))return false;const id="gun-"+Math.random().toString(36).slice(2,6);state.shops.gun.push({id,owner,region,markup:Number(markup)||1.2});save(state);refreshSelectors();log(`${owner} created gun store in ${region} x${markup}`);return true}
function createFoodStore(owner,region,markup){if(!state.licenses.food.includes(owner))return false;const id="food-"+Math.random().toString(36).slice(2,6);state.shops.food.push({id,owner,region,markup:Number(markup)||1.0});save(state);refreshSelectors();log(`${owner} created food store in ${region} x${markup}`);return true}
function buyWeapon(player,storeId,level){const store=state.shops.gun.find(s=>s.id===storeId);if(!store)return false;level=Number(level);if((store.stock||0)<=0)return false;const price=(basePrices.weapon[level]||0)*store.markup;const p=state.players[player];if(p.money<price)return false;p.money-=price;store.stock=(store.stock||0)-1;energyUse(p,2);p.weaponLevel=Math.max(p.weaponLevel,level);save(state);syncHeader();statusEconomy();refreshSelectors();log(`${p.name} bought weapon L${level} for ${price} at ${store.owner}`);return true}
function buyFood(player,storeId){const store=state.shops.food.find(s=>s.id===storeId);if(!store)return false;if((store.stock||0)<=0)return false;const price=basePrices.food*store.markup;const p=state.players[player];if(p.money<price)return false;p.money-=price;store.stock=(store.stock||0)-1;energyGain(p,20);save(state);syncHeader();statusEconomy();refreshSelectors();log(`${p.name} bought food (+energy) for ${price} at ${store.owner}`);return true}
function applyLicense(player,type){const id="app-"+Math.random().toString(36).slice(2,6);state.licenseApplications.push({id,type,applicant:player,status:"pending",ts:Date.now()});save(state);refreshApps();log(`${player} applied for ${type} license`);return true}
function approveApp(approver,id,approve){const p=state.players[approver];if(!p||(p.government!=="president"&&p.government!=="governor"))return false;const app=state.licenseApplications.find(a=>a.id===id);if(!app||app.status!=="pending")return false;app.status=approve?"approved":"rejected";if(approve)pushUnique(state.licenses[app.type],app.applicant);save(state);refreshApps();log(`${approver} ${approve?"approved":"rejected"} ${app.type} for ${app.applicant}`);return true}
function addXp(p,amt){p.xp=(p.xp||0)+amt;const need=p.level*100;if(p.xp>=need){p.level+=1;p.xp-=need;log(`${p.name} leveled up to ${p.level}`)}save(state);syncHeader()}
function marry(player,spouse,route){const a=state.players[player];const b=state.players[spouse];if(!a||!b)return false;if(!a.age||!b.age||a.age<18||b.age<18)return false;a.marriedTo=b.name;b.marriedTo=a.name;save(state);refreshFamilyInfo();log(`${a.name} married ${b.name} via ${route}`);return true}
function haveSex(player){const p=state.players[player];if(!p||!p.marriedTo)return false;p.sexCount+=1;energyUse(p,5);save(state);refreshFamilyInfo();log(`${p.name} had sex with ${p.marriedTo}`);return true}
function boostFertility(player,stage){const p=state.players[player];stage=Number(stage);if(stage<3||stage>5)return false;const cost=stage*5000;if(p.money<cost)return false;p.money-=cost;p.fertilityBoost=Math.max(p.fertilityBoost,stage);save(state);syncHeader();refreshFamilyInfo();log(`${p.name} boosted fertility to stage ${stage}`);return true}
function tryForBaby(player){const a=state.players[player];if(!a||!a.marriedTo)return false;const b=state.players[a.marriedTo];if(!b)return false;let chance=0.05+0.02*(a.sexCount||0);if(a.fertilityBoost>=3)chance+=0.05*(a.fertilityBoost-2);chance=Math.min(0.8,chance);const roll=Math.random();if(roll<chance){const babyName=`Baby_${Math.random().toString(36).slice(2,5)}`;ensurePlayer(babyName);const bb=state.players[babyName];bb.age=0;bb.gender=Math.random()<0.5?"male":"female";bb.family=a.family||b.family;save(state);log(`New baby born: ${babyName}`);return true}else{log(`No baby this time`);return false}}
function wholesaleGun(storeId,qty){const s=state.shops.gun.find(x=>x.id===storeId);if(!s)return false;qty=Number(qty)||0;if(qty<=0)return false;const unit=basePrices.weapon[1]*0.6;const cost=unit*qty;state.treasury.government+=cost;s.stock=(s.stock||0)+qty;save(state);statusEconomy();refreshSelectors();log(`Wholesale gun stock +${qty} to ${s.owner}`);return true}
function wholesaleFood(storeId,qty){const s=state.shops.food.find(x=>x.id===storeId);if(!s)return false;qty=Number(qty)||0;if(qty<=0)return false;const unit=basePrices.food*0.6;const cost=unit*qty;state.treasury.government+=cost;s.stock=(s.stock||0)+qty;save(state);statusEconomy();refreshSelectors();log(`Wholesale food stock +${qty} to ${s.owner}`);return true}
function createBM(type,region,markup){const id="bm-"+Math.random().toString(36).slice(2,6);state.black.shops.push({id,type,region,markup:Number(markup)||1.5});save(state);refreshSelectors();log(`Created black market ${type} in ${region}`);return true}
function buyBMWeapon(player,shopId){const s=state.black.shops.find(x=>x.id===shopId&&x.type==="weapon");if(!s)return false;const price=(basePrices.weapon[1])*s.markup;const p=state.players[player];if(p.money<price)return false;p.money-=price;energyUse(p,2);p.weaponLevel=Math.max(p.weaponLevel,1);save(state);syncHeader();statusEconomy();log(`${p.name} bought BM weapon for ${price}`);return true}
function buyBMFood(player,shopId){const s=state.black.shops.find(x=>x.id===shopId&&x.type==="food");if(!s)return false;const price=basePrices.food*s.markup;const p=state.players[player];if(p.money<price)return false;p.money-=price;energyGain(p,20);save(state);syncHeader();statusEconomy();log(`${p.name} bought BM food for ${price}`);return true}
function createParty(name){if(!name)return false;if(state.parties.find(p=>p.name.toLowerCase()===name.toLowerCase()))return false;state.parties.push({name,treasury:0,members:[]});save(state);refreshSelectors();statusEconomy();log(`Party created: ${name}`);return true}
function joinParty(player,name){const p=state.players[player];const pa=state.parties.find(x=>x.name===name);if(!pa)return false;p.party=name;pushUnique(pa.members,player);save(state);statusEconomy();log(`${player} joined party ${name}`);return true}
function depositParty(player,amt){const p=state.players[player];const pa=p.party?state.parties.find(x=>x.name===p.party):null;amt=Number(amt)||0;if(!pa||amt<=0||p.money<amt)return false;p.money-=amt;pa.treasury+=amt;save(state);statusEconomy();syncHeader();log(`${p.name} deposited ${amt} to ${pa.name}`);return true}
function justiceArrest(officer,target,minutes){const o=state.players[officer];if(!o||!o.security)return false;const t=state.players[target];minutes=Number(minutes)||state.durations.prisonMin;if(!t)return false;const end=Date.now()+dur(minutes);state.justice.prisons[target]={endTs:end};state.timers.push({type:"prison",player:target,endTs:end});save(state);statusEconomy();log(`${officer} arrested ${target} for ${minutes}m`);return true}
function justiceFine(officer,target,amt){const o=state.players[officer];if(!o||!o.security)return false;amt=Number(amt)||0;const t=state.players[target];if(!t||amt<=0)return false;const pay=Math.min(amt,t.money);t.money-=pay;state.treasury.government+=pay;save(state);syncHeader();statusEconomy();log(`${officer} fined ${target} ${pay}`);return true}
function justiceSetBail(actor,target,amt){const a=state.players[actor];if(!a||(a.security==null&&a.government==null))return false;amt=Number(amt)||0;state.justice.bail[target]=amt;save(state);log(`${actor} set bail for ${target} to ${amt}`);return true}
function justicePayBail(target){const p=state.players[target];const b=state.justice.bail[target];if(!b||p.money<b)return false;p.money-=b;state.treasury.government+=b;delete state.justice.prisons[target];state.timers=state.timers.filter(t=>!(t.type==="prison"&&t.player===target));save(state);syncHeader();statusEconomy();log(`${target} paid bail ${b} and was released`);return true}
function justiceScheduleTrial(actor,target){const a=state.players[actor];if(!a||(a.security==null&&a.government==null))return false;const end=Date.now()+dur(state.durations.trialMin);state.justice.trials.push({target,endTs:end});state.timers.push({type:"trial",player:target,endTs:end});save(state);statusEconomy();log(`${actor} scheduled trial for ${target}`);return true}
function isPrisoner(name){return !!state.justice.prisons[name]}
function tickTimers(){const now=Date.now();const remain=[];state.timers.forEach(t=>{if(t.endTs>now){remain.push(t)}else{if(t.type==="prison"){delete state.justice.prisons[t.player];log(`${t.player} served sentence`) } if(t.type==="trial"){if(t.caseId){const c=state.justice.cases.find(x=>x.id===t.caseId);const e=(c&&c.evidence?c.evidence.length:0);const ch=(c&&c.charges?c.charges.length:0);const win=Math.random()<(0.5+0.1*e+0.05*ch);if(win){const end=Date.now()+dur(state.durations.prisonMin);state.justice.prisons[t.player]={endTs:end};remain.push({type:"prison",player:t.player,endTs:end});if(c){c.verdict="guilty";c.status="closed"}log(`${t.player} convicted, prison set`)}else{if(c){c.verdict="not_guilty";c.status="closed"}log(`${t.player} acquitted`)}} else {const win=Math.random()<0.6;if(win){const end=Date.now()+dur(state.durations.prisonMin);state.justice.prisons[t.player]={endTs:end};remain.push({type:"prison",player:t.player,endTs:end});log(`${t.player} convicted, prison set`)}else{log(`${t.player} acquitted`)}}} if(t.type==="travel"||t.type==="drive"){const p=state.players[t.player];if(p){p.stateRegion=t.dest} log(`${t.player} arrived at ${t.dest}`)} if(t.type==="car"){const p=state.players[t.player];if(p){p.cars.push({model:t.model,fuel:0})} log(`${t.player} car delivered: ${t.model}`)} } });state.timers=remain;save(state);statusEconomy()}
function seedDemo(){const names=[];for(let i=1;i<=12;i++){const n=`Demo${i}`;ensurePlayer(n);const p=state.players[n];p.age=25; p.gender=Math.random()<0.5?"male":"female"; p.money=10000; names.push(n)} if(!state.families.find(f=>f.name==="DemoFam"))createFamily("DemoFam"); names.forEach(n=>joinFamily("DemoFam",n)); setPlayerStateRegion(names[0],state.regions[0]); setPlayerStateRegion(names[1],state.regions[1]); setPlayerStateRegion(names[2],state.regions[2]); setPlayerStateRegion(names[3],state.regions[3]); if(!state.gangs.find(g=>g.name==="DemoGang"))createGang("DemoGang"); joinGang("DemoGang",names[4]); joinGang("DemoGang",names[5]); joinSecurity("police",names[6]); joinSecurity("army",names[7]); joinSecurity("navy",names[8]); joinSecurity("air",names[9]); save(state);refreshSelectors();statusEconomy();log("Seeded demo players")}
function quickSwitch(name){if(!name)return;setCurrent(name)}
function buyCar(player,model){const p=state.players[player];const cost=carPrices[model];if(!p||!cost||p.money<cost)return false;p.money-=cost;const end=Date.now()+30*60000;state.timers.push({type:"car",player,model,endTs:end});save(state);syncHeader();statusEconomy();log(`${player} purchased ${model}; delivery in 30m`);return true}
function travel(player,dest){const p=state.players[player];if(!p)return false;const end=Date.now()+30*60000;state.timers.push({type:"travel",player,dest,endTs:end});save(state);statusEconomy();log(`${player} flying to ${dest}; arrival in 30m`);return true}
function enableAuto(termMin,openMin){state.autoElections.enabled=true;state.autoElections.termMin=Number(termMin)||60;state.autoElections.openDurMin=Number(openMin)||10;state.autoElections.nextOpenTs=Date.now()+state.autoElections.termMin*60000;save(state);statusEconomy();log("Auto elections enabled")}
function disableAuto(){state.autoElections.enabled=false;state.autoElections.nextOpenTs=null;state.autoElections.closeTs=null;save(state);statusEconomy();log("Auto elections disabled")}
function tickAutoElections(){const a=state.autoElections;if(!a.enabled)return;const now=Date.now();if(!state.elections.open&&a.nextOpenTs&&now>=a.nextOpenTs){electionsOpen();a.closeTs=now+a.openDurMin*60000;save(state);statusEconomy();log("Auto elections opened")} if(state.elections.open&&a.closeTs&&now>=a.closeTs){electionsClose();a.nextOpenTs=now+a.termMin*60000;a.closeTs=null;save(state);statusEconomy();log("Auto elections closed")}}
function postChatGeneral(from,msg){state.chats.general.push({from,ts:new Date().toLocaleTimeString(),msg});state.chats.general=state.chats.general.slice(-100);save(state);refreshChats()}
function postChatFamily(from,msg){const p=state.players[from];if(!p||!p.family)return false;const f=p.family;if(!state.chats.family[f])state.chats.family[f]=[];state.chats.family[f].push({from,ts:new Date().toLocaleTimeString(),msg});state.chats.family[f]=state.chats.family[f].slice(-100);save(state);refreshChats();return true}
function postChatGang(from,msg){const p=state.players[from];if(!p||!p.guild)return false;const g=p.guild;if(!state.chats.gang[g])state.chats.gang[g]=[];state.chats.gang[g].push({from,ts:new Date().toLocaleTimeString(),msg});state.chats.gang[g]=state.chats.gang[g].slice(-100);save(state);refreshChats();return true}
function postChatCommand(from,msg){state.chats.command.push({from,ts:new Date().toLocaleTimeString(),msg});state.chats.command=state.chats.command.slice(-100);save(state);refreshChats()}
function setStateBindings(){
  $("#btnSetState")&&$("#btnSetState").addEventListener("click",()=>{const p=curr();if(!p)return;const r=$("#selectState").value||state.regions[0];setPlayerStateRegion(p.name,r)});
  $("#btnAppointChief")&&$("#btnAppointChief").addEventListener("click",()=>{const p=curr();if(!p)return;const br=$("#inputChiefBranch").value.trim().toLowerCase();const nm=$("#inputChiefName").value.trim();if(!appointChief(br,nm))log("Appoint chief failed")});
  $("#btnAppointMajor")&&$("#btnAppointMajor").addEventListener("click",()=>{const p=curr();if(!p)return;const br=$("#inputMajorBranch").value.trim().toLowerCase();const nm=$("#inputMajorName").value.trim();const r=p.stateRegion||state.regions[0];if(!appointMajor(br,nm,r))log("Appoint major failed")});
  $("#btnDispatchPresident")&&$("#btnDispatchPresident").addEventListener("click",()=>{const p=curr();if(!p)return;const br=$("#inputDispatchBranch").value.trim().toLowerCase();const id=$("#inputRiotId").value.trim();if(!dispatchPresident(p.name,br,id))log("Dispatch failed")});
  $("#btnDispatchGovernor")&&$("#btnDispatchGovernor").addEventListener("click",()=>{const p=curr();if(!p)return;const br=$("#inputDispatchBranch").value.trim().toLowerCase();const id=$("#inputRiotId").value.trim();if(!dispatchGovernor(p.name,br,id))log("Dispatch failed")});
  $("#btnCreateRiotAdv")&&$("#btnCreateRiotAdv").addEventListener("click",()=>{const p=curr();if(!p)return;const r=$("#selectRiotState").value||state.regions[0];const sev=Math.max(1,Math.min(5,Number($("#inputRiotSeverity").value||3)));const f=$("#selectRiotFunding").value; if(!createRiotAdv(p.name,r,sev,f))log("Riot funding failed")});
  $("#btnJoinBank")&&$("#btnJoinBank").addEventListener("click",()=>{const p=curr();if(!p)return;joinBankStaff(p.name)});
  $("#btnDeposit")&&$("#btnDeposit").addEventListener("click",()=>{const p=curr();if(!p)return;const a=$("#inputDeposit").value;deposit(p.name,a)});
  $("#btnWithdraw")&&$("#btnWithdraw").addEventListener("click",()=>{const p=curr();if(!p)return;const a=$("#inputWithdraw").value;withdraw(p.name,a)});
  $("#btnRobBank")&&$("#btnRobBank").addEventListener("click",()=>{const p=curr();if(!p)return;const r=$("#selectBankState").value||state.regions[0];if(!robBank(p.name,r))log("Rob failed")});
  $("#btnGrantLicense")&&$("#btnGrantLicense").addEventListener("click",()=>{const targ=$("#inputLicenseName").value.trim();const t=$("#selectLicenseType").value; if(!grantLicense(t,targ))log("Grant failed")});
  $("#btnCreateGunStore")&&$("#btnCreateGunStore").addEventListener("click",()=>{const p=curr();if(!p)return;const r=$("#selectGunState").value||state.regions[0];const m=$("#inputGunMarkup").value; if(!createGunStore(p.name,r,m))log("Create gun store failed"); else refreshSelectors()});
  $("#btnCreateFoodStore")&&$("#btnCreateFoodStore").addEventListener("click",()=>{const p=curr();if(!p)return;const r=$("#selectFoodState").value||state.regions[0];const m=$("#inputFoodMarkup").value; if(!createFoodStore(p.name,r,m))log("Create food store failed"); else refreshSelectors()});
  $("#btnBuyWeapon")&&$("#btnBuyWeapon").addEventListener("click",()=>{const p=curr();if(!p)return;const sid=$("#selectGunStore").value;const lvl=$("#selectWeaponLevel").value; if(!buyWeapon(p.name,sid,lvl))log("Buy weapon failed")});
  $("#btnBuyFood")&&$("#btnBuyFood").addEventListener("click",()=>{const p=curr();if(!p)return;const sid=$("#selectFoodStore").value; if(!buyFood(p.name,sid))log("Buy food failed")});
  $("#btnRegister")&&$("#btnRegister").addEventListener("click",()=>{const p=curr();if(!p)return;const a=Number($("#inputAge").value)||null;const g=$("#selectGender").value||null;p.age=a;p.gender=g;save(state);syncHeader()});
  $("#btnApplyLicense")&&$("#btnApplyLicense").addEventListener("click",()=>{const p=curr();if(!p)return;const t=$("#selectApplyLicense").value;applyLicense(p.name,t);refreshApps()});
  $("#btnApproveApp")&&$("#btnApproveApp").addEventListener("click",()=>{const p=curr();if(!p)return;const id=$("#inputAppId").value.trim();if(!approveApp(p.name,id,true))log("Approve failed")});
  $("#btnRejectApp")&&$("#btnRejectApp").addEventListener("click",()=>{const p=curr();if(!p)return;const id=$("#inputAppId").value.trim();if(!approveApp(p.name,id,false))log("Reject failed")});
  $("#btnMarryCourt")&&$("#btnMarryCourt").addEventListener("click",()=>{const p=curr();if(!p)return;const s=$("#inputSpouse").value.trim();if(!marry(p.name,s,"court"))log("Marriage failed")});
  $("#btnMarryChurch")&&$("#btnMarryChurch").addEventListener("click",()=>{const p=curr();if(!p)return;const s=$("#inputSpouse").value.trim();if(!marry(p.name,s,"church"))log("Marriage failed")});
  $("#btnHaveSex")&&$("#btnHaveSex").addEventListener("click",()=>{const p=curr();if(!p)return;haveSex(p.name);refreshFamilyInfo()});
  $("#btnBoostFertility")&&$("#btnBoostFertility").addEventListener("click",()=>{const p=curr();if(!p)return;const st=$("#selectBoostStage").value;boostFertility(p.name,st)});
  $("#btnTryBaby")&&$("#btnTryBaby").addEventListener("click",()=>{const p=curr();if(!p)return;tryForBaby(p.name)});
  $("#btnSendGeneral")&&$("#btnSendGeneral").addEventListener("click",()=>{const p=curr();if(!p)return;const m=$("#inputChatGeneral").value.trim();if(m){postChatGeneral(p.name,m);$("#inputChatGeneral").value=""}});
  $("#btnSendFamily")&&$("#btnSendFamily").addEventListener("click",()=>{const p=curr();if(!p)return;const m=$("#inputChatFamily").value.trim();if(m){postChatFamily(p.name,m);$("#inputChatFamily").value=""}});
  $("#btnSendGang")&&$("#btnSendGang").addEventListener("click",()=>{const p=curr();if(!p)return;const m=$("#inputChatGang").value.trim();if(m){postChatGang(p.name,m);$("#inputChatGang").value=""}});
  $("#btnSendCommand")&&$("#btnSendCommand").addEventListener("click",()=>{const p=curr();if(!p)return;const m=$("#inputChatCommand").value.trim();if(m){postChatCommand(p.name,m);$("#inputChatCommand").value=""}});
  $("#btnAssignRank")&&$("#btnAssignRank").addEventListener("click",()=>{const p=curr();if(!p||!p.guild)return;const m=$("#selectGangMember").value;const r=$("#selectGangRank").value;if(!setGangRank(p.name,m,r))log("Assign failed")});
  $("#btnSeedDemo")&&$("#btnSeedDemo").addEventListener("click",()=>{seedDemo();refreshSelectors()});
  $("#btnQuickSwitch")&&$("#btnQuickSwitch").addEventListener("click",()=>{const n=$("#selectQuickPlayer").value;quickSwitch(n)});
  $("#btnFine")&&$("#btnFine").addEventListener("click",()=>{const p=curr();if(!p)return;const t=$("#inputTarget").value.trim();const a=$("#inputFineAmt").value;justiceFine(p.name,t,a)});
  $("#btnArrest")&&$("#btnArrest").addEventListener("click",()=>{const p=curr();if(!p)return;const t=$("#inputTarget").value.trim();const m=$("#inputSentenceMin").value;justiceArrest(p.name,t,m)});
  $("#btnCreateCase")&&$("#btnCreateCase").addEventListener("click",()=>{const p=curr();if(!p)return;const s=$("#inputTarget").value.trim();const ch=$("#inputCharge").value.trim();const ev=$("#inputEvidence").value.trim();createCase(p.name,s,ch,ev)});
  $("#btnAddCharge")&&$("#btnAddCharge").addEventListener("click",()=>{const id=$("#inputCaseId").value.trim();const ch=$("#inputCharge").value.trim();addCaseCharge(id,ch)});
  $("#btnAddEvidence")&&$("#btnAddEvidence").addEventListener("click",()=>{const id=$("#inputCaseId").value.trim();const ev=$("#inputEvidence").value.trim();addCaseEvidence(id,ev)});
  $("#btnCaseTrial")&&$("#btnCaseTrial").addEventListener("click",()=>{const p=curr();if(!p)return;const id=$("#inputCaseId").value.trim();scheduleCaseTrial(p.name,id)});
  $("#btnSetBail")&&$("#btnSetBail").addEventListener("click",()=>{const p=curr();if(!p)return;const t=$("#inputTarget").value.trim();const a=$("#inputBailAmt").value;justiceSetBail(p.name,t,a)});
  $("#btnPayBail")&&$("#btnPayBail").addEventListener("click",()=>{const p=curr();if(!p)return;justicePayBail(p.name)});
  $("#btnScheduleTrial")&&$("#btnScheduleTrial").addEventListener("click",()=>{const p=curr();if(!p)return;const t=$("#inputTarget").value.trim();justiceScheduleTrial(p.name,t)});
  $("#btnCreateParty")&&$("#btnCreateParty").addEventListener("click",()=>{const n=$("#inputPartyName").value.trim();if(!createParty(n))log("Party create failed")});
  $("#btnJoinParty")&&$("#btnJoinParty").addEventListener("click",()=>{const p=curr();if(!p)return;const n=$("#selectParty").value;joinParty(p.name,n)});
  $("#btnDepositParty")&&$("#btnDepositParty").addEventListener("click",()=>{const p=curr();if(!p)return;const a=$("#inputPartyDeposit").value;depositParty(p.name,a)});
  $("#btnStartCampaign")&&$("#btnStartCampaign").addEventListener("click",()=>{const p=curr();if(!p)return;const b=Number($("#inputCampaignBudget").value||0);if(!p.party)return;const pa=state.parties.find(x=>x.name===p.party);if(!pa||pa.treasury<b){log("Insufficient party funds");return}pa.treasury-=b;pa.influence=(pa.influence||0)+b/1000;save(state);statusEconomy();log(`Campaign started: ${b}`)});
  $("#btnWholesaleGun")&&$("#btnWholesaleGun").addEventListener("click",()=>{const id=$("#selectWholesaleGun").value;const q=$("#inputWholesaleGunQty").value;wholesaleGun(id,q)});
  $("#btnWholesaleFood")&&$("#btnWholesaleFood").addEventListener("click",()=>{const id=$("#selectWholesaleFood").value;const q=$("#inputWholesaleFoodQty").value;wholesaleFood(id,q)});
  $("#btnCreateBM")&&$("#btnCreateBM").addEventListener("click",()=>{const t=$("#selectBMType").value;const r=$("#selectBMState").value;const m=$("#inputBMMarkup").value;createBM(t,r,m)});
  $("#btnBuyBMWeapon")&&$("#btnBuyBMWeapon").addEventListener("click",()=>{const p=curr();if(!p)return;const id=$("#selectBMShop").value;buyBMWeapon(p.name,id)});
  $("#btnBuyBMFood")&&$("#btnBuyBMFood").addEventListener("click",()=>{const p=curr();if(!p)return;const id=$("#selectBMShop").value;buyBMFood(p.name,id)});
  $("#btnEnableAutoEl")&&$("#btnEnableAutoEl").addEventListener("click",()=>{const tm=$("#inputTermMin").value;const od=$("#inputOpenDur").value;enableAuto(tm,od)});
  $("#btnDisableAutoEl")&&$("#btnDisableAutoEl").addEventListener("click",()=>{disableAuto()});
  $("#btnBuyCar")&&$("#btnBuyCar").addEventListener("click",()=>{const p=curr();if(!p)return;const m=$("#selectCarModel").value;buyCar(p.name,m)});
  $("#btnTravel")&&$("#btnTravel").addEventListener("click",()=>{const p=curr();if(!p)return;const d=$("#selectTravelDest").value;travel(p.name,d)});
  // Dealers
  $("#btnCreateDealer")&&$("#btnCreateDealer").addEventListener("click",()=>{const p=curr();if(!p)return;const r=$("#selectDealerRegion").value;const m=$("#inputDealerMarkup").value;createDealer(p.name,r,m)});
  $("#btnWholesaleDealer")&&$("#btnWholesaleDealer").addEventListener("click",()=>{const d=$("#selectDealer").value;const model=$("#selectDealerModel").value;const q=$("#inputDealerQty").value;wholesaleDealer(d,model,q)});
  $("#btnBuyFromDealer")&&$("#btnBuyFromDealer").addEventListener("click",()=>{const p=curr();if(!p)return;const d=$("#selectDealerBuy").value;const model=$("#selectDealerBuyModel").value;buyFromDealer(p.name,d,model)});
  $("#btnRefuelCar")&&$("#btnRefuelCar").addEventListener("click",()=>{const p=curr();if(!p)return;refuelCar(p.name,10)});
  $("#btnDrive")&&$("#btnDrive").addEventListener("click",()=>{const p=curr();if(!p)return;const dest=$("#selectTravelDest").value;drive(p.name,dest)});
  // Airline
  $("#btnSetAir")&&$("#btnSetAir").addEventListener("click",()=>{const dest=$("#selectTravelDest").value;const price=$("#inputAirPrice").value;const seats=$("#inputAirSeats").value;setAirRoute(dest,price,seats)});
  $("#btnBuyTicket")&&$("#btnBuyTicket").addEventListener("click",()=>{const p=curr();if(!p)return;const dest=$("#selectTravelDest").value;buyTicket(p.name,dest)});
  // Durations/time scale
  $("#btnApplyDurations")&&$("#btnApplyDurations").addEventListener("click",()=>{const ts=$("#inputTimeScale").value;const pr=$("#inputDurPrison").value;const tri=$("#inputDurTrial").value;const tr=$("#inputDurTravel").value;const del=$("#inputDurDelivery").value;setDurations(ts,pr,tri,tr,del)});
  // Properties
  $("#btnCreateLand")&&$("#btnCreateLand").addEventListener("click",()=>{const p=curr();if(!p)return;const r=$("#selectPropState").value;const price=$("#inputLandPrice").value;createLand(p.name,r,price)});
  $("#btnBuyLand")&&$("#btnBuyLand").addEventListener("click",()=>{const p=curr();if(!p)return;const id=$("#inputLandId").value.trim();buyLand(p.name,id)});
  $("#btnBuildHouse")&&$("#btnBuildHouse").addEventListener("click",()=>{const p=curr();if(!p)return;const id=$("#inputLandId").value.trim();buildHouse(p.name,id)});
  $("#btnSellProperty")&&$("#btnSellProperty").addEventListener("click",()=>{const p=curr();if(!p)return;const id=$("#inputLandId").value.trim();sellProperty(p.name,id)});
}
const oldBind=bind;
function bind(){oldBind(); $("#btnWork")&&$("#btnWork").addEventListener("click",()=>{work2()});}
function initSectionTabs(){const buttons=$$(".sectab");const cards=$$(".card[data-section]");function setActive(sec){let first=true;buttons.forEach(b=>b.classList.toggle("active",b.dataset.section===sec));cards.forEach(c=>{if(c.dataset.section===sec){c.classList.remove("hidden");if(first){c.classList.remove("collapsed");first=false}else{c.classList.add("collapsed")}}else{c.classList.add("hidden")}});window.scrollTo({top:0,behavior:"smooth"})}buttons.forEach(b=>b.addEventListener("click",()=>setActive(b.dataset.section)));if(buttons.length){setActive(buttons[0].dataset.section)}}
function initCardCollapses(){const heads=$$(".card h2");heads.forEach(h=>{const card=h.closest(".card");if(card&&card.classList.contains("navtabs"))return;h.addEventListener("click",()=>{const c=h.closest(".card");if(c)c.classList.toggle("collapsed")})})}
function startApp(){try{bind();setStateBindings();initSectionTabs();initCardCollapses();refreshAllPlus();refreshApps();refreshChats();refreshGangMembersSelector();refreshFamilyInfo();syncHeader();}catch(e){console.error(e)}}
document.addEventListener("DOMContentLoaded",startApp);
setInterval(()=>{const p=curr();if(p)salaryTick()},30000);
setInterval(()=>{treatHospitals();tickTimers();tickAutoElections()},5000);
window.addEventListener("load",()=>{refreshAllPlus();refreshApps();refreshChats();refreshGangMembersSelector();refreshFamilyInfo()})
