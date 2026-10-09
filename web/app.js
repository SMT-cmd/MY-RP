const $ = id => document.getElementById(id);
let accountMode = false, refreshToken = '', expiresAt = 0;
let key = '', view = null, pending = null, busy = false, nearbyScene = null;
let dataSaver=!!navigator.connection?.saveData,preferredGraphics='medium';
try{const saved=localStorage.getItem('simulator-data-saver');if(saved!==null)dataSaver=saved==='1';const graphics=localStorage.getItem('simulator-graphics');if(['low','medium','high'].includes(graphics))preferredGraphics=graphics;}catch{/* Preferences also work without browser storage. */}
$('data-saver').checked=dataSaver;$('graphics').value=dataSaver?'low':preferredGraphics;$('graphics').disabled=dataSaver;
const renderQuality=()=>dataSaver?'low':$('graphics').value;
// Preserve only unconfirmed command intent across reloads. Never persist the key.
try { pending = JSON.parse(sessionStorage.getItem('simulator-pending') || 'null'); } catch { pending = null; }
function rememberPending() { try { if (pending) sessionStorage.setItem('simulator-pending', JSON.stringify(pending)); else sessionStorage.removeItem('simulator-pending'); } catch { /* In-memory retry still works if browser storage is unavailable. */ } }
const money = minor => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(minor / 100);
const texts = [
  'You can begin starter work immediately. Your starter accommodation provides a place to settle in. Basic help and NPC work are intended to keep survival reachable even when player employers are unavailable.',
  'Protect your personal information. Never share a password or access key. In the full service, block and report tools will let you manage unwanted contact and request moderation support.',
  'Spend only the available balance. Reserved funds and escrow are not freely spendable. Read an agreement before accepting its price, obligations and cancellation terms.',
  'An arrest does not establish guilt. Cases require review and adjudication. In the full simulator, lawful processes and appeal routes govern civic consequences.',
  'Professional careers require the relevant education, examinations and current licences. Wealth and cosmetics do not replace credentials. Review these principles before your foundation exam.'
];
function notice(message, error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error); }
const paragraph=text=>{const p=document.createElement('p');p.textContent=text;return p;};
function actionButton(label,type,payload={},disabled=false){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=busy||!!pending||disabled||window.WorldSync?.ready()===false;b.addEventListener('click',()=>perform(type,payload));return b;}
function renderWorld(){
 const world=view.world;if(!world)return;const pos=world.position;
 if(window.WorldSync?.ready()!==false&&nearbyScene?.scope?.region===pos.region&&nearbyScene.scope.leaseVersion===pos.leaseVersion&&nearbyScene.scope.interior===pos.interior&&(nearbyScene.scope.homeId??null)===(pos.homeId??null)&&nearbyScene.cursor>=(view.sync?.cursor??0))world.people=nearbyScene.people;
 $('world-neighbours').replaceChildren(...(world.people??[]).map(c=>{const row=document.createElement('li');row.textContent=c.name+' · nearby';return row;}));
 $('world-title').textContent=world.region.capital+' · '+world.region.name;
 $('world-location').textContent=world.trip?.status==='travelling'?`Travelling to ${world.trip.destination}.`:pos.interior?`Inside ${world.home ? world.home.name+' · '+world.home.address : world.map.buildings.find(b=>b.id===pos.interior)?.name}.`:`${pos.district} · tile (${pos.x},${pos.y}) · location lease ${pos.leaseVersion}`;
 $('world-controls').hidden=!!pos.interior||!!world.trip;document.querySelectorAll('#world-controls button').forEach(b=>b.disabled=busy||!!pending||window.WorldSync?.ready()===false);
 $('world-interactions').replaceChildren();if(pos.interior)$('world-interactions').append(actionButton('Exit to the city','ExitBuilding',{leaseVersion:pos.leaseVersion},!!world.trip));else world.nearby.forEach(b=>$('world-interactions').append(actionButton('Enter '+b.name,'EnterBuilding',{buildingId:b.id,leaseVersion:pos.leaseVersion},!!world.trip)));
 if(world.home){
  $('world-interactions').append(paragraph(`${world.home.guest?'Visiting '+world.home.name:'Your home'} · room tile (${world.home.x},${world.home.y}). Walk around the furniture.`));
  for(const [label,dx,dy] of [['North',0,-1],['West',-1,0],['South',0,1],['East',1,0]])$('world-interactions').append(actionButton('Walk '+label,'MoveInterior',{dx,dy,leaseVersion:pos.leaseVersion}));
  for(const f of world.home.fixtures){if(f.use?.capacity)$('world-interactions').append(paragraph(`${f.name}: ${f.use.free} of ${f.use.capacity} positions free${f.use.currentSlot!==null?' · you are using position '+(f.use.currentSlot+1):''}.`));$('world-interactions').append(actionButton(f.name+' · '+(f.action==='Rest'?'Rest':f.action==='RequestFoodAssistance'?'Request protective meal':f.action==='Sit'?'Sit':f.action==='Read'?'Read':f.action==='Wash'?'Wash hands':f.action==='Dress'?'Use wardrobe':'Inspect'),'InteractHomeFixture',{fixtureId:f.id,leaseVersion:pos.leaseVersion},!f.nearby||f.allowed===false||f.use?.capacity>0&&!f.use.availableSlots.length));}
 }
 const navigation=$('world-navigation');navigation.replaceChildren();navigation.hidden=!!pos.interior||!!world.trip;
 if(!navigation.hidden){
  const heading=document.createElement('summary');heading.textContent='Places and neighbourhoods';navigation.append(heading);
  const destination=(label,event,detail)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=busy||!!pending;b.addEventListener('click',()=>window.dispatchEvent(new CustomEvent(event,{detail:{...detail,leaseVersion:pos.leaseVersion}})));navigation.append(b);};
  for(const b of [...world.map.buildings.filter(b=>b.id!=='shelter'),world.residence,...(world.guestEntrances??[])])destination('Visit '+b.name,'building-select',{buildingId:b.id});
  for(const d of world.map.districts??[])destination('Walk to '+d.name,'world-tile-select',{...d.landmark,homeId:null});
  for(const o of world.nearbyStreetObjects??[])destination('Sit on courtyard bench','street-object-select',{objectId:o.id});
 }
 $('guide').disabled=busy||!!pending||!!pos.interior||!!world.trip||Math.abs(pos.x-7)+Math.abs(pos.y-7)>2;
 $('travel-panel').hidden=pos.interior!=='terminal'||!!world.trip;
 if($('travel-destination').dataset.origin!==pos.region){$('travel-destination').replaceChildren(...world.routes.map(r=>{const option=document.createElement('option');option.value=r.destination;option.textContent=r.destination;return option;}));$('travel-destination').dataset.origin=pos.region;}
 renderTravelQuote();$('travel-actions').replaceChildren();$('travel-status').textContent='';
 if(world.trip?.status==='travelling'){const trip=world.trip;$('travel-status').textContent=`${trip.origin} → ${trip.destination} · arrival ${new Date(trip.arriveAt).toLocaleTimeString()} · fare ${money(trip.fee)} reserved. Refresh at arrival time.`;$('travel-actions').append(actionButton('Arrive at destination','ArriveTravel',{leaseVersion:pos.leaseVersion},view.serverTime<trip.arriveAt));if(view.serverTime<trip.departAt+5000)$('travel-actions').append(actionButton('Cancel before departure and refund','CancelTravel'));}
 window.WorldRenderer?.update(world,renderQuality()).catch(error=>notice(error.message,true));
}
function renderTravelQuote(){const route=view?.world?.routes.find(r=>r.destination===$('travel-destination').value);if(route)$('travel-quote').textContent=`${money(route.fee)} · about ${Math.ceil(route.duration/1000)} seconds. ${route.explanation}`;}
function renderEducation(){
 const ed=view.education;if(!ed)return;
 if(!$('life-goal').childElementCount)ed.tracks.forEach(track=>{const o=document.createElement('option');o.value=track;o.textContent=track;$('life-goal').append(o);});$('life-goal').value=ed.foundation.goal??'ordinary';
 if(!$('scholarship-course').childElementCount)ed.courses.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name+' · '+money(c.fee);$('scholarship-course').append(o);});
 $('course-catalogue').replaceChildren();ed.courses.forEach(c=>{const box=document.createElement('details'),summary=document.createElement('summary');summary.textContent=c.name+' · '+money(c.fee);box.append(summary,paragraph(`Prerequisite: ${c.prerequisite??'Foundation certificate'}. ${c.terms}`));
  const funded=ed.scholarships.find(a=>a.recipient===view.citizen.id&&a.course===c.id&&a.status==='offered'&&a.expiresAt>view.serverTime);
  const button=actionButton(funded?'Review and use tuition award':'Review and enrol', 'EnrollCourse',{courseId:c.id,acceptedFee:c.fee,acceptTerms:true,...(funded?{scholarshipId:funded.id}:{}),...($('school-provider').value?{schoolId:$('school-provider').value}:{})},!view.citizen.certificate||ed.enrolments.some(x=>x.course===c.id&&x.status!=='cancelled'));
  // The labelled action expressly accepts the displayed fee and cancellation terms.
  box.append(button);$('course-catalogue').append(box);
 });
 $('course-progress').replaceChildren();ed.enrolments.forEach(en=>{const box=document.createElement('article');box.className='course-record';const title=document.createElement('h3');title.textContent=en.courseName;box.append(title,paragraph(`${en.status} · ${en.steps}/3 study activities · ${en.practice}/${en.practiceRequired} supervised sessions.`));
  if(en.status==='studying'){
   if(en.task){box.append(paragraph(en.task.prompt));en.task.choices.forEach((choice,index)=>box.append(actionButton(choice,'StudyCourse',{enrolmentId:en.id,choice:index},view.serverTime<en.nextStudyAt)));}
   else {const form=document.createElement('form');en.exam.forEach((q,i)=>{const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=q.prompt;field.append(legend);q.choices.forEach((text,j)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='course-q'+i;input.value=j;input.required=true;label.append(input,document.createTextNode(text));field.append(label);});form.append(field);});const submit=document.createElement('button');submit.type='submit';submit.textContent='Submit official course exam';submit.disabled=busy||!!pending||view.serverTime<en.examAt;form.append(submit);form.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(form);perform('TakeCourseExam',{enrolmentId:en.id,answers:en.exam.map((_,i)=>Number(data.get('course-q'+i)))});});box.append(paragraph('Exam opens '+new Date(en.examAt).toLocaleTimeString()+'. Refresh to check.'),form);}
   box.append(actionButton('Cancel study and return reserved tuition','CancelCourse',{enrolmentId:en.id}));
  }
  if(en.status==='exam-passed'){box.append(paragraph('NPC supervisor: follow the approved procedure and record the verified practice.'),actionButton('Use approved supervised procedure','SupervisedPractice',{enrolmentId:en.id,choice:0},view.serverTime<en.nextPracticeAt));}
  if(en.status==='completed'){box.append(paragraph('Qualification: '+en.certificate));if(ed.courses.find(c=>c.id===en.course)?.licence&&!ed.licences.some(l=>l.enrolmentId===en.id))box.append(actionButton('Issue scoped game licence','IssueLicence',{enrolmentId:en.id}));}
  $('course-progress').append(box);
 });
 $('licence-records').replaceChildren();ed.licences.forEach(l=>{const c=ed.courses.find(c=>c.track===l.track),box=document.createElement('div');box.append(paragraph(`${l.track}: ${l.current?'current':'expired'} · expires ${new Date(l.expiresAt).toLocaleString()}`));if(view.serverTime>=l.expiresAt-86400000)box.append(actionButton('Confirm continuing practice and renew for '+money(Math.ceil(c.fee*.05)),'RenewLicence',{licenceId:l.id,choice:0,acceptedFee:Math.ceil(c.fee*.05)}));$('licence-records').append(box);});
 $('scholarship-records').replaceChildren();ed.scholarships.forEach(a=>{const box=document.createElement('div');box.append(paragraph(`${a.course} award · ${a.status} · reserved ${money(a.amount)} · expires ${new Date(a.expiresAt).toLocaleDateString()}`));if(a.donor===view.citizen.id&&a.status==='offered'&&a.expiresAt<=view.serverTime)box.append(actionButton('Refund unused award','RefundScholarship',{scholarshipId:a.id}));$('scholarship-records').append(box);});
}
function lock() {
  const disconnected=window.WorldSync?.ready()===false;
  document.querySelectorAll('button:not(#staff-panel button)').forEach(button => { button.disabled = busy || (pending && !['retry', 'access-submit'].includes(button.id)) || disconnected&&!['account-logout','account-login','account-signup','access-submit','connection-takeover'].includes(button.id); });
  if (view?.citizen) render();
  $('retry').disabled = disconnected || busy || !key || accountMode && pending?.accountId!==view?.accountId;
  $('account-logout').disabled=busy||!!pending&&pending.accountId===view?.accountId;
  if(disconnected)document.querySelectorAll('button:not(#staff-panel button)').forEach(b=>{if(!['account-logout','account-login','account-signup','access-submit','connection-takeover'].includes(b.id))b.disabled=true;});
  $('connection-takeover').disabled=busy;
}
async function request(path, command, retried=false, extraHeaders={}) {
  if(accountMode&&refreshToken&&!retried&&Date.now()>expiresAt-30000)await refreshAccount();
  const response = await fetch(path, { method: command ? 'POST' : 'GET', headers: { ...(accountMode ? {Authorization:'Bearer '+key} : {'x-development-key':key}), ...extraHeaders,...(command ? { 'Content-Type': 'application/json' } : {}) }, body: command ? JSON.stringify(path==='/api/commands'?{...command,clientLease:window.WorldSync?.fence()}:command) : undefined, signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  if(accountMode&&response.status===401&&refreshToken&&!retried){await refreshAccount();return request(path,command,true,extraHeaders);}
  if (!response.ok) { const error = new Error(data.message || 'The request failed.'); error.code=data.error;error.auth = response.status === 401; error.confirmed = [400, 409, 413, 415].includes(response.status); throw error; }
  return data;
}
async function perform(type, payload = {}) {
  if (busy || pending) return;
  if(window.WorldSync?.ready()===false){notice('Reconnect this tab before issuing a new action.',true);return;}
  pending = { id: crypto.randomUUID(), type, payload,accountId:view?.accountId };
  rememberPending();
  await sendPending();
}
async function sendPending() {
  if (!pending || busy) return;
  if(accountMode&&pending.accountId!==view?.accountId){notice('Sign in to the account that created your unconfirmed action.',true);return;}
  busy = true; lock();let openWardrobe=false;
  try {
    const result = await request('/api/commands', pending);
    pending = null; rememberPending(); view = result.view;
    const detail = result.receipt.detail;
    openWardrobe=result.receipt.type==='InteractHomeFixture'&&view.world?.home?.fixtures.some(f=>f.id===detail.fixtureId&&f.action==='Dress');
    const messages = { CreateCitizen: 'Your citizen is ready. Welcome to your first day.', CompleteShift: `Shift settled. You earned ${money(detail.amount)}.`, BuyBasicMeal: `Meal purchased for ${money(detail.amount)}.`, CompleteLesson: `Module ${detail.day} is complete.`, SubmitExam: detail.passed ? `You passed with ${detail.score}%. Your certificate is recorded.` : `You scored ${detail.score}%. Review module five, then try again.` };
    notice((messages[result.receipt.type] || detail.message || 'Action confirmed.') + (result.replayed ? ' The original receipt was recovered.' : ''));
  } catch (error) {
    if (error.auth) {key='';stopWalking();window.WorldSync?.stop();}
    if (error.confirmed) { pending = null; rememberPending(); }
    notice(error.message + (pending ? ' Your action identifier has been kept for a safe retry.' : ''), true);
  } finally { busy = false; $('retry-panel').hidden = !pending; lock();if(openWardrobe){$('appearance-panel').scrollIntoView?.({block:'nearest',behavior:'auto'});$('appearance-hair').focus();} }
}
function render() {
  const citizen = view.citizen;
  window.AdminUI?.observe(accountMode&&key&&view.accountId?{actor:view.accountId,request,acceptSession:data=>{useSession(data);stopWalking();void window.WorldSync?.reconnect();}}:null);
  window.WorldSync?.observe(key?view:null,{request,authFailed:error=>{key='';refreshToken='';stopWalking();nearbyScene=null;render();notice(error.message,true);},credentials:()=>accountMode?{authorization:'Bearer '+key}:{developmentKey:key},status:connected=>{stopWalking();if(!connected&&view?.world){nearbyScene=null;view.world.people=[];$('world-neighbours')?.replaceChildren();window.WorldRenderer?.update(view.world,renderQuality());}lock();},snapshot:next=>{view=next;render();},frame:data=>{if(!view?.world)return;nearbyScene=data;const p=view.world.position;if(data.scope?.region!==p.region||data.scope?.leaseVersion!==p.leaseVersion||data.scope?.interior!==p.interior||(data.scope?.homeId??null)!==(p.homeId??null))return;view.world.people=data.people;view.world.serverTime=data.serverTime;const list=$('world-neighbours');if(list)list.replaceChildren(...data.people.map(c=>{const row=document.createElement('li');row.textContent=c.name+' · nearby';return row;}));window.WorldRenderer?.update(view.world,renderQuality());}});
  window.AppearanceUI?.render(view,perform,busy||!!pending||window.WorldSync?.ready()===false);
  if(view.regions && !$('citizen-state').dataset.complete){$('citizen-state').replaceChildren(...view.regions.map(region=>{const option=document.createElement('option');option.value=region.name;option.textContent=region.name+' · '+region.capital;return option;}));$('citizen-state').value='Lagos';$('citizen-state').dataset.complete='true';}
  $('access-panel').hidden = accountMode || !!key; $('account-panel').hidden = !accountMode || !!key; $('account-logout').hidden = !accountMode || !key; $('creation-panel').hidden = !key || !!citizen; $('citizen-panel').hidden = !key || !citizen;
  window.RelationshipsUI?.render(key&&citizen?view:null,perform,busy||!!pending||window.WorldSync?.ready()===false);
  if (!key || !citizen) return;
  $('greeting').textContent = `Welcome, ${citizen.name}.`;
  $('balance').textContent = money(view.balance); $('housing').textContent = citizen.housing; $('region').textContent = citizen.state;
  $('school-status').textContent = citizen.certificate ? 'Foundation certified' : `${citizen.completedLessons.length} of 5 modules complete`;
  renderWorld();window.TeachingUI?.render(view,perform,busy||!!pending||window.WorldSync?.ready()===false);renderEducation();window.EconomyUI?.render(view,perform,busy||!!pending||window.WorldSync?.ready()===false);
  window.FurnishingUI?.render(view,perform,busy||!!pending||window.WorldSync?.ready()===false);
  window.HomeVisitsUI?.render(view,perform,busy||!!pending||window.WorldSync?.ready()===false);
  window.PropertyUI?.render(view,perform,busy||!!pending||window.WorldSync?.ready()===false);
  window.MobilityUI?.render(view,perform,busy||!!pending||window.WorldSync?.ready()===false);
  window.HealthcareUI?.render(view,perform,busy||!!pending||window.WorldSync?.ready()===false);
  window.InsuranceUI?.render(view,perform,busy||!!pending||window.WorldSync?.ready()===false);
  window.GovernanceUI?.render(view,perform,busy||!!pending||window.WorldSync?.ready()===false);
  if(view.life){
    const life=view.life,house=life.household;
    $('needs-status').textContent=`Food ${life.needs.hunger}/100 · Energy ${life.needs.energy}/100 · Health ${life.needs.health}/100`;
    $('offline-summary').textContent=life.offlineSummary || '';
    $('citizen-reference').textContent=`Citizen ID: ${citizen.id} · Virtual SIM: ${life.phone}`;
    for(const field of ['dm','location','presence','relationships'])$('privacy-'+field).checked=life.privacy[field];
    $('family-status').textContent=house?`${house.name} · ${house.kind==='npc'?house.band+' NPC family':'Player household'} · Shared funds ${money(house.balance)}`:'You have personal control and starter shelter.';
    $('family-terms').textContent=house?.terms || 'Joining a household requires your consent and does not transfer your personal money.';
    $('household-create').hidden=!!house;$('household-invite').hidden=!house||house.kind!=='player'||house.role!=='owner';$('household-contribution').hidden=!house||house.kind!=='player';
    const actions=$('family-actions');actions.replaceChildren();
    const action=(text,type,payload={})=>{const button=document.createElement('button');button.type='button';button.textContent=text;button.disabled=busy||!!pending;button.addEventListener('click',()=>perform(type,payload));actions.append(button);};
    if(house?.kind==='npc'){action('Review family period','ReviewFamilyPeriod');action('Request daily allowance','RequestFamilyAllowance');}
    if(house)action('Leave and return to starter shelter','LeaveHousehold');
    const invites=$('family-invitations');invites.replaceChildren();
    life.invitations.forEach(invite=>{const box=document.createElement('div'),text=document.createElement('p');text.textContent=`Invitation to ${invite.name}. ${invite.terms}`;box.append(text);for(const [label,type] of [['Accept these terms and join','AcceptHousehold'],['Decline','DeclineHousehold']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=busy||!!pending;button.addEventListener('click',()=>perform(type,{invitationId:invite.id,consent:true}));box.append(button);}invites.append(box);});
  }
  const nextShift = citizen.lastShiftAt === null ? 0 : citizen.lastShiftAt + 60000;
  const active=view.work?.active;
  if(view.work && !$('work-job').childElementCount) view.work.jobs.forEach(job=>{const option=document.createElement('option');option.value=job.id;option.textContent=job.name; $('work-job').append(option);});
  $('work').disabled = busy || !!pending || !!active || nextShift > view.serverTime;
  $('work-job').disabled=busy || !!pending || !!active;
  $('work-status').textContent=active?`${active.job} · ${active.steps}/${active.total} checks · ${money(active.wage)} reserved · settlement opens ${new Date(active.settlementAt).toLocaleTimeString()}. Refresh to check availability.`:nextShift > view.serverTime ? `Next shift available at ${new Date(nextShift).toLocaleTimeString()}. Refresh then to check availability.` : 'Available now. The server checks your daily wage allowance and the regional employer budget.';
  $('work-task').replaceChildren();$('work-actions').replaceChildren();
  if(active){
    if(active.current){const title=document.createElement('h3');title.textContent=active.current.label;$('work-task').append(title);active.current.choices.forEach((choice,index)=>{const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=choice;button.disabled=busy||!!pending||view.serverTime<active.stepAt;button.addEventListener('click',()=>perform('WorkStep',{shiftId:active.id,choice:index}));$('work-task').append(button);});}
    const action=document.createElement('button');action.type='button';action.textContent=active.current?'Cancel this uncompleted task':'Settle reserved wage';action.disabled=busy||!!pending||(!active.current&&!active.ready);action.addEventListener('click',()=>perform(active.current?'CancelWork':'CompleteShift',{shiftId:active.id}));$('work-actions').append(action);
  }
  $('meal').disabled = busy || !!pending || view.balance < 5000;
  $('lessons').replaceChildren();
  view.lessons.forEach(lesson => {
    const eligible = lesson.unlockAt <= view.serverTime && (lesson.day === 1 || citizen.completedLessons.includes(lesson.day - 1));
    const item = document.createElement('details'); item.className = 'lesson';
    const title = document.createElement('summary'); title.textContent = `Day ${lesson.day} · ${lesson.title}`;
    const text = document.createElement('p'); text.textContent = texts[lesson.day - 1];
    const status = document.createElement('small'); status.textContent = lesson.complete ? 'Complete' : eligible ? 'Ready to study' : `Unlocks ${new Date(lesson.unlockAt).toLocaleString()} · complete the previous module first`;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = lesson.complete && lesson.day === 5 ? 'Review module five' : 'Complete this module';
    const practical=view.education?.foundation.practicals.find(p=>p.day===lesson.day);
    button.disabled = busy || !!pending || !eligible || !practical?.ready || (lesson.complete && lesson.day !== 5); button.addEventListener('click', () => perform('CompleteLesson', { day: lesson.day }));
    item.append(title, text, status);if(practical?.current){item.append(paragraph(practical.current.prompt));practical.current.choices.forEach((choice,index)=>item.append(actionButton(choice,'FoundationPractice',{day:lesson.day,choice:index},!eligible)));}else if(!practical?.ready)item.append(paragraph(lesson.day===1?'Visit the shelter, buy a meal and settle a paid starter task.':lesson.day===2?'Save your privacy preferences after the training activities.':'Choose a life direction in the study panel.'));item.append(button);$('lessons').append(item);
  });
  const unlocked = citizen.completedLessons.length === 5 && !citizen.reviewRequired && !citizen.certificate;
  $('exam-status').textContent = citizen.certificate ? `Certificate ${citizen.certificate.id} · curriculum ${citizen.certificate.curriculumVersion} · issued ${new Date(citizen.certificate.issuedAt).toLocaleDateString()}` : citizen.reviewRequired ? 'Review module five before retaking the exam. Retakes have no fee.' : unlocked ? 'Answer 20 randomized questions at your own pace. A score of 80% or above earns a foundation certificate.' : 'Complete all five daily modules and their practical activities to unlock the exam. Retakes have no fee.';
  $('exam-form').hidden = !unlocked;
  if($('questions').dataset.examId!==view.examId){$('questions').replaceChildren();$('questions').dataset.examId=view.examId;}
  if (!$('questions').childElementCount) view.exam.forEach((question, i) => {
    const field = document.createElement('fieldset'), legend = document.createElement('legend'); legend.textContent = `${i + 1}. ${question.question}`; field.append(legend);
    question.answers.forEach((answer, j) => { const label = document.createElement('label'), input = document.createElement('input'), text = document.createElement('span'); input.type = 'radio'; input.name = `q${i}`; input.value = j; input.required = true; text.textContent = answer; label.append(input, text); field.append(label); });
    $('questions').append(field);
  });
  $('receipts').replaceChildren();
  const labels = { CreateCitizen: 'Independent life started', CompleteShift: 'Cleaner shift settled', BuyBasicMeal: 'Basic meal purchased', CompleteLesson: 'Foundation module completed', SubmitExam: 'Foundation exam submitted' };
  [...view.receipts].reverse().forEach(receipt => { const item = document.createElement('li'), text = document.createElement('span'), time = document.createElement('time'); text.textContent = labels[receipt.type] || receipt.type; time.dateTime = new Date(receipt.at).toISOString(); time.textContent = new Date(receipt.at).toLocaleString(); item.append(text, time); $('receipts').append(item); });
}
$('access-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || accountMode) return; key = $('access-key').value.trim(); busy = true; lock();
  try { view = await request('/api/citizen'); $('access-key').value = ''; render(); $('retry-panel').hidden = !pending; notice(pending ? 'An unconfirmed action was recovered. Retry it to check the original result.' : 'Local game opened.'); } catch (error) { key = ''; notice(error.message, true); } finally { busy = false; lock(); }
});
$('create-form').addEventListener('submit', event => { event.preventDefault(); perform('CreateCitizen', { name: $('citizen-name').value, state: $('citizen-state').value, path:$('start-path').value, appearance:window.AppearanceUI?.creation(), adultConfirmed: $('adult-confirmed').checked }); });
$('rest').addEventListener('click',()=>perform('Rest'));
$('care').addEventListener('click',()=>perform('RequestBasicCare'));
$('privacy-form').addEventListener('submit',event=>{event.preventDefault();perform('SetPrivacy',Object.fromEntries(['dm','location','presence','relationships'].map(field=>[field,$('privacy-'+field).checked])));});
$('household-create').addEventListener('submit',event=>{event.preventDefault();perform('CreateHousehold',{name:$('household-name').value,consent:$('household-consent').checked});});
$('household-invite').addEventListener('submit',event=>{event.preventDefault();perform('InviteHousehold',{citizenId:$('household-citizen').value.trim()});});
$('household-contribution').addEventListener('submit',event=>{event.preventDefault();const amount=Math.round(Number($('household-amount').value)*100);if(confirm(`Give ${money(amount)} to shared household funds? This is a gift controlled by the owner.`))perform('ContributeHousehold',{amount,consent:true});});
$('work').addEventListener('click', () => perform('BeginWork',{jobId:$('work-job').value}));
$('guide').addEventListener('click',()=>perform('MeetGuide'));
document.querySelectorAll('#world-controls button').forEach(button=>button.addEventListener('click',()=>perform('MoveCitizen',{dx:Number(button.dataset.dx),dy:Number(button.dataset.dy),leaseVersion:view.world.position.leaseVersion})));
$('graphics').addEventListener('change',()=>{if(dataSaver){$('graphics').value='low';return;}preferredGraphics=$('graphics').value;try{localStorage.setItem('simulator-graphics',preferredGraphics);}catch{}if(view?.world)renderWorld();});
$('data-saver').addEventListener('change',()=>{dataSaver=$('data-saver').checked;$('graphics').value=dataSaver?'low':preferredGraphics;$('graphics').disabled=dataSaver;try{localStorage.setItem('simulator-data-saver',dataSaver?'1':'0');}catch{}if(view?.world)renderWorld();});
$('school-provider').addEventListener('change',()=>renderEducation());
$('travel-destination').addEventListener('change',renderTravelQuote);
$('travel-book').addEventListener('click',()=>{const route=view.world.routes.find(r=>r.destination===$('travel-destination').value);if(route)perform('BeginTravel',{destination:route.destination,acceptedFee:route.fee,leaseVersion:view.world.position.leaseVersion});});
$('save-goal').addEventListener('click',()=>perform('ChooseGoal',{goal:$('life-goal').value}));
$('scholarship-form').addEventListener('submit',event=>{event.preventDefault();const course=view.education.courses.find(c=>c.id===$('scholarship-course').value);if(confirm(`Reserve ${money(course.fee)} for this citizen’s ${course.name} tuition?`))perform('OfferScholarship',{citizenId:$('scholarship-citizen').value.trim(),courseId:course.id,acceptedFee:course.fee});});
$('meal').addEventListener('click', () => perform('BuyBasicMeal'));
$('retry').addEventListener('click', sendPending);
$('refresh').addEventListener('click', async () => { if (busy || pending) return; busy = true; lock(); try { view = await request('/api/citizen'); notice('Progress refreshed.'); } catch (error) { if (error.auth) {key='';stopWalking();window.WorldSync?.stop();} notice(error.message, true); } finally { busy = false; lock(); } });
$('exam-form').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); perform('SubmitExam', {examId:view.examId, answers: view.exam.map((_, i) => Number(form.get(`q${i}`))) }); });

async function accountRequest(action,payload={}){
 const response=await fetch('/api/auth/'+action,{method:'POST',headers:{'Content-Type':'application/json',...(action==='logout'?{Authorization:'Bearer '+key}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
 const data=await response.json();if(!response.ok)throw new Error(data.message||'Account request failed.');return data;
}
function useSession(data){key=data.access_token;refreshToken=data.refresh_token;expiresAt=Date.now()+data.expires_in*1000;}
async function refreshAccount(){try{useSession(await accountRequest('refresh',{refresh_token:refreshToken}));}catch(error){key='';refreshToken='';stopWalking();render();throw error;}}
$('account-form').addEventListener('submit',async event=>{
 if(window.AuthReturn?.cleanupFailed){event.preventDefault();$('account-password').value='';notice('Close this account link and open the game from its main address to sign in.',true);return;}
 event.preventDefault();if(busy||!accountMode)return;busy=true;lock();
 const payload={email:$('account-email').value.trim(),password:$('account-password').value};$('account-password').value='';
 try{const data=await accountRequest(event.submitter?.id==='account-signup'?'signup':'login',payload);if(data.confirmationRequired){notice(data.message);return;}useSession(data);view=await request('/api/citizen');render();notice(pending?'Signed in. Resolve your unconfirmed action before continuing.':'Signed in. Your saved citizen is ready.');}
 catch(error){key='';refreshToken='';notice(error.message,true);}finally{busy=false;lock();}
});
$('account-logout').addEventListener('click',async()=>{
 if(busy||pending&&pending.accountId===view?.accountId)return;stopWalking();busy=true;lock();try{await accountRequest('logout');window.WorldSync?.stop();window.AdminUI?.reset();key='';refreshToken='';view=null;window.RelationshipsUI?.render(null,perform,true);window.WorldRenderer?.destroy();$('citizen-panel').hidden=true;$('creation-panel').hidden=true;$('access-panel').hidden=true;$('account-panel').hidden=false;$('account-logout').hidden=true;notice('Signed out.');}catch(error){notice(error.message,true);}finally{busy=false;lock();}
});
fetch('/api/config').then(r=>{if(!r.ok)throw Error();return r.json();}).then(config=>{accountMode=config.mode==='supabase';$('access-panel').hidden=accountMode;$('account-panel').hidden=!accountMode;if(accountMode&&window.AuthReturn){notice(window.AuthReturn.cleanupFailed?'Close this account link and open the game from its main address to sign in.':window.AuthReturn.failed?'The account link could not be completed. Try signing in or request a new link.':'Account link opened. Sign in with your email and password to continue.',window.AuthReturn.failed||window.AuthReturn.cleanupFailed);}}).catch(()=>notice('The account configuration could not be loaded. Refresh to try again.',true));
const movementKeys={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]};
let heldDirection=null,stepTimer=null,lastStep=0,walkRun=0;
function cancelRoute(){walkRun++;}
function stopWalking(){cancelRoute();heldDirection=null;if(stepTimer)clearInterval(stepTimer);stepTimer=null;}
function step(){if(!heldDirection||busy||pending||window.WorldSync?.ready()===false||!view?.citizen||!key||document.hidden)return;const world=view.world;if(!world||world.trip||world.position.interior&&!world.home)return;if(Date.now()-lastStep<650)return;lastStep=Date.now();const [dx,dy]=movementKeys[heldDirection];perform(world.home?'MoveInterior':'MoveCitizen',{dx,dy,leaseVersion:world.position.leaseVersion});}
document.addEventListener('keydown',event=>{if(!movementKeys[event.key]||event.ctrlKey||event.altKey||event.metaKey||event.target.closest?.('input,textarea,select,[contenteditable="true"],dialog')||!key)return;event.preventDefault();cancelRoute();heldDirection=event.key;if(!stepTimer)stepTimer=setInterval(step,50);step();});
document.addEventListener('keyup',event=>{if(event.key===heldDirection)stopWalking();});
window.addEventListener('blur',stopWalking);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopWalking();});

async function followRoute(world,route,action){
 stopWalking();if(!route){notice('There is no clear route to that object or tile.');return;}
 const run=++walkRun,lease=world.position.leaseVersion,homeId=world.home?.id,homeVersion=world.home?.version,region=world.position.region,actor=view.accountId,credential=key;
 const current=()=>run===walkRun&&!pending&&!busy&&window.WorldSync?.ready()!==false&&key===credential&&view?.accountId===actor&&view?.world?.position.leaseVersion===lease&&view.world.position.region===region&&view.world.home?.id===homeId&&view.world.home?.version===homeVersion&&!view.world.trip;
 for(const direction of route){
  if(!current())return;const wait=Math.max(0,650-(Date.now()-lastStep));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));if(!current())return;
  const before=view.world.home??view.world.position;lastStep=Date.now();await perform(homeId?'MoveInterior':'MoveCitizen',{...direction,leaseVersion:lease});
  const after=view?.world?.home??view?.world?.position;if(!current()||after.x!==before.x+direction.dx||after.y!==before.y+direction.dy)return;
 }
 if(action&&current())await perform(action.type,{...action.payload,leaseVersion:lease});
}
window.addEventListener('home-fixture-select',event=>{const d=event.detail,w=view?.world;if(!key||!w?.home||w.home.id!==d.homeId||w.position.leaseVersion!==d.leaseVersion||busy||pending)return;const f=w.home.fixtures.find(f=>f.id===d.fixtureId);if(f&&f.allowed!==false&&!(f.use?.capacity>0&&!f.use.availableSlots.length))followRoute(w,window.Walking?.approach(w,f),{type:'InteractHomeFixture',payload:{fixtureId:f.id}});});
window.addEventListener('building-select',event=>{const d=event.detail,w=view?.world;if(!key||!w||w.position.interior||w.trip||w.position.leaseVersion!==d.leaseVersion||busy||pending)return;const b=[...w.map.buildings.filter(b=>b.id!=='shelter'),w.residence,...(w.guestEntrances??[])].find(b=>b.id===d.buildingId);if(b)followRoute(w,window.Walking?.approach(w,b),{type:'EnterBuilding',payload:{buildingId:b.id}});});
window.addEventListener('street-object-select',event=>{const d=event.detail,w=view?.world;if(!key||!w||w.position.interior||w.trip||w.position.leaseVersion!==d.leaseVersion||busy||pending)return;const o=w.map.streetObjects?.find(o=>o.id===d.objectId);if(o)followRoute(w,window.Walking?.approach(w,o),{type:'InteractStreetObject',payload:{objectId:o.id}});});
window.addEventListener('world-tile-select',event=>{
 const d=event.detail,w=view?.world;if(!key||busy||pending||!w||w.trip||w.position.interior&&!w.home||w.home?.id!==d.homeId&&!(d.homeId===null&&!w.home)||w.position.leaseVersion!==d.leaseVersion)return;
 followRoute(w,window.Walking?.path(w,d.x,d.y));
});
