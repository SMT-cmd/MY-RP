const $ = id => document.getElementById(id);
let key = '', view = null, pending = null, busy = false;
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
function lock() {
  document.querySelectorAll('button').forEach(button => { button.disabled = busy || (pending && !['retry', 'access-submit'].includes(button.id)); });
  if (view?.citizen) render();
  $('retry').disabled = busy || !key;
}
async function request(path, command) {
  const response = await fetch(path, { method: command ? 'POST' : 'GET', headers: { 'x-development-key': key, ...(command ? { 'Content-Type': 'application/json' } : {}) }, body: command ? JSON.stringify(command) : undefined, signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.message || 'The request failed.'); error.auth = response.status === 401; error.confirmed = [400, 409, 413, 415].includes(response.status); throw error; }
  return data;
}
async function perform(type, payload = {}) {
  if (busy || pending) return;
  pending = { id: crypto.randomUUID(), type, payload };
  rememberPending();
  await sendPending();
}
async function sendPending() {
  if (!pending || busy) return;
  busy = true; lock();
  try {
    const result = await request('/api/commands', pending);
    pending = null; rememberPending(); view = result.view;
    const detail = result.receipt.detail;
    const messages = { CreateCitizen: 'Your citizen is ready. Welcome to your first day.', CompleteShift: `Shift settled. You earned ${money(detail.amount)}.`, BuyBasicMeal: `Meal purchased for ${money(detail.amount)}.`, CompleteLesson: `Module ${detail.day} is complete.`, SubmitExam: detail.passed ? `You passed with ${detail.score}%. Your certificate is recorded.` : `You scored ${detail.score}%. Review module five, then try again.` };
    notice(messages[result.receipt.type] + (result.replayed ? ' The original receipt was recovered.' : ''));
  } catch (error) {
    if (error.auth) key = '';
    if (error.confirmed) { pending = null; rememberPending(); }
    notice(error.message + (pending ? ' Your action identifier has been kept for a safe retry.' : ''), true);
  } finally { busy = false; $('retry-panel').hidden = !pending; lock(); }
}
function render() {
  const citizen = view.citizen;
  $('access-panel').hidden = !!key; $('creation-panel').hidden = !key || !!citizen; $('citizen-panel').hidden = !key || !citizen;
  if (!key || !citizen) return;
  $('greeting').textContent = `Welcome, ${citizen.name}.`;
  $('balance').textContent = money(view.balance); $('housing').textContent = citizen.housing; $('region').textContent = citizen.state;
  $('school-status').textContent = citizen.certificate ? 'Foundation certified' : `${citizen.completedLessons.length} of 5 modules complete`;
  const nextShift = citizen.lastShiftAt === null ? 0 : citizen.lastShiftAt + 60000;
  $('work').disabled = busy || !!pending || nextShift > view.serverTime;
  $('work-status').textContent = nextShift > view.serverTime ? `Next shift available at ${new Date(nextShift).toLocaleTimeString()}. Refresh then to check availability.` : 'Available now. The server checks the shared daily budget.';
  $('meal').disabled = busy || !!pending || view.balance < 5000;
  $('lessons').replaceChildren();
  view.lessons.forEach(lesson => {
    const eligible = lesson.unlockAt <= view.serverTime && (lesson.day === 1 || citizen.completedLessons.includes(lesson.day - 1));
    const item = document.createElement('details'); item.className = 'lesson';
    const title = document.createElement('summary'); title.textContent = `Day ${lesson.day} · ${lesson.title}`;
    const text = document.createElement('p'); text.textContent = texts[lesson.day - 1];
    const status = document.createElement('small'); status.textContent = lesson.complete ? 'Complete' : eligible ? 'Ready to study' : `Unlocks ${new Date(lesson.unlockAt).toLocaleString()} · complete the previous module first`;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = lesson.complete && lesson.day === 5 ? 'Review module five' : 'Complete this module';
    button.disabled = busy || !!pending || !eligible || (lesson.complete && lesson.day !== 5); button.addEventListener('click', () => perform('CompleteLesson', { day: lesson.day }));
    item.append(title, text, status, button); $('lessons').append(item);
  });
  const unlocked = citizen.completedLessons.length === 5 && !citizen.reviewRequired && !citizen.certificate;
  $('exam-status').textContent = citizen.certificate ? `Certificate ${citizen.certificate.id} · issued ${new Date(citizen.certificate.issuedAt).toLocaleDateString()}` : citizen.reviewRequired ? 'Review module five before retaking the exam. Retakes have no fee.' : unlocked ? 'Answer all five fixture questions. A score of 80% or above earns a foundation certificate.' : 'Complete all five daily modules to unlock the exam. Retakes have no fee.';
  $('exam-form').hidden = !unlocked;
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
  event.preventDefault(); if (busy) return; key = $('access-key').value.trim(); busy = true; lock();
  try { view = await request('/api/citizen'); $('access-key').value = ''; render(); $('retry-panel').hidden = !pending; notice(pending ? 'An unconfirmed action was recovered. Retry it to check the original result.' : 'Preview opened. Your progress comes from the local server.'); } catch (error) { key = ''; notice(error.message, true); } finally { busy = false; lock(); }
});
$('create-form').addEventListener('submit', event => { event.preventDefault(); perform('CreateCitizen', { name: $('citizen-name').value, state: $('citizen-state').value, adultConfirmed: $('adult-confirmed').checked }); });
$('work').addEventListener('click', () => perform('CompleteShift'));
$('meal').addEventListener('click', () => perform('BuyBasicMeal'));
$('retry').addEventListener('click', sendPending);
$('refresh').addEventListener('click', async () => { if (busy || pending) return; busy = true; lock(); try { view = await request('/api/citizen'); notice('Progress refreshed.'); } catch (error) { if (error.auth) key = ''; notice(error.message, true); } finally { busy = false; lock(); } });
$('exam-form').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); perform('SubmitExam', { answers: view.exam.map((_, i) => Number(form.get(`q${i}`))) }); });
