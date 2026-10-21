import './style.css';
import { BorrowMeshClient, type ProtocolEntry, type ToolResponse } from './mcp.js';
import { routeIntent, type Intent, type ProjectIntent } from './intent-router.js';
import type { Booking, Bundle, CatalogItem, Hold, LibraryState } from '../shared/types.js';
import type { ElicitRequest, ElicitResult } from '@modelcontextprotocol/sdk/types.js';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="masthead">
    <a class="brand" href="/" aria-label="BorrowMesh home"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9h24L20 31 8 9Zm0 0 12 10L32 9M20 19v12"/><circle cx="8" cy="9" r="3.5"/><circle cx="32" cy="9" r="3.5"/><circle cx="20" cy="19" r="3.5"/><circle cx="20" cy="31" r="3.5"/></svg></span><span>Borrow<span class="brand-light">Mesh</span><small>A whole project, together.</small></span></a>
    <div class="library-label"><span class="library-dot"></span><div>MAPLE LANE TOOL LIBRARY<small>Shared tools. Complete project kits.</small></div></div>
    <div class="connection-group"><span id="connection" role="status">Connecting…</span><button id="connect" data-testid="connect-button" class="text-button">Reconnect</button></div>
  </header>
  <main class="workbench">
    <section class="conversation-panel" aria-labelledby="conversation-title">
      <div class="panel-heading"><div><p class="eyebrow">01 / LET’S MAKE SOMETHING</p><h1 id="conversation-title">Your project starts here.</h1></div><span class="voice-orbit" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>
      <div class="conversation" id="conversation" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div class="suggestions" aria-label="Suggested requests">
        <button data-testid="chip-requirements" data-say="What do I need to build a planter box on Saturday afternoon?">Plan a planter box <span>↗</span></button>
        <button data-testid="chip-find" data-say="Find me a kit">Find me a kit <span>↗</span></button>
        <button data-testid="chip-booking" data-say="What did I book?">What did I book? <span>↗</span></button>
        <button data-testid="chip-issue" data-say="The clamps are broken">The clamps are broken <span>↗</span></button>
        <button data-testid="chip-cancel" data-say="Cancel my booking">Cancel my booking <span>↗</span></button>
      </div>
      <form id="composer" class="composer"><label class="sr-only" for="utterance">Tell BorrowMesh about your project</label><input id="utterance" data-testid="utterance-input" placeholder="Tell me what you want to make…" autocomplete="off" maxlength="500" /><button id="send" data-testid="send-button" aria-label="Send request" type="submit">↑</button></form>
      <div class="voice-controls"><label><input id="speak" type="checkbox" /> Spoken replies</label><button id="listen" type="button" class="text-button">Use microphone</button><span id="voice-status" class="sr-only" role="status"></span></div>
    </section>
    <section class="project-panel" aria-labelledby="kit-title">
      <div class="board-heading"><div><p class="eyebrow">02 / YOUR WORKING SET</p><h2 id="kit-title">Your complete kit.<br /><em>Tools and bench, together.</em></h2></div><span id="booking-status" data-testid="booking-status" class="board-status">Ready to plan</span></div>
      <div id="kit-board" data-testid="kit-board" class="kit-board"></div>
      <section class="bench-section" aria-labelledby="bench-title"><div class="bench-heading"><h3 id="bench-title">The workshop bench</h3><span>Saturday, October 24 · 2026</span></div><div id="bench-timeline" data-testid="bench-timeline"></div></section>
      <div id="comparison-heading" class="comparison-heading"><div><p class="eyebrow">03 / FIND YOUR FIT</p><h3>Compare complete kits.</h3></div><span id="bundle-count">Complete kits, compared</span></div>
      <div id="bundle-carousel" class="bundle-carousel" aria-label="Compare compatible kits" tabindex="0"></div>
      <div id="action-bar" class="action-bar"></div>
    </section>
  </main>
  <details class="protocol" data-testid="protocol-inspector" id="protocol"><summary data-testid="protocol-toggle"><span><span class="terminal-symbol">{ }</span> Protocol inspector <small>REAL MCP · STREAMABLE HTTP</small></span><span id="protocol-count">0 messages <span aria-hidden="true">⌄</span></span></summary><div class="protocol-meta" id="protocol-meta">Waiting for initialization.</div><div class="protocol-log" data-testid="protocol-log" id="protocol-log"></div></details>
  <footer><span>Simulated Alexa+-style experience for the Build, Ship, Shape hackathon. Not affiliated with or endorsed by Amazon. All library data is fictional.</span><button id="reset" data-testid="reset-button" class="text-button">Reset demo</button></footer>
  <dialog id="consent" data-testid="consent-dialog" aria-labelledby="consent-title" aria-describedby="consent-message"><div class="consent-icon" aria-hidden="true">↔</div><p class="eyebrow">REVIEW THE SUBSTITUTE</p><h2 id="consent-title">Accept this change<br />to your kit?</h2><p id="consent-message"></p><p class="consent-note">Your complete kit will only be booked if you accept. Decline or cancel books nothing.</p><label class="consent-check"><input id="consent-confirm" type="checkbox" checked /> I accept this compatible substitution.</label><div class="consent-actions"><button id="accept" data-testid="consent-accept" class="primary-button">Accept & book kit</button><button id="decline" data-testid="consent-decline" class="secondary-button">Decline</button><button id="cancel-consent" data-testid="consent-cancel" class="text-button">Cancel</button></div></dialog>
  <dialog id="kit-detail" aria-labelledby="kit-detail-title" data-testid="kit-detail-dialog"><div id="kit-detail-content"></div><button id="close-kit-detail" class="secondary-button">Back to comparison</button></dialog>
`;

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (value: unknown) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
let library: LibraryState | undefined;
let bundles: Bundle[] = [];
let hold: Hold | undefined;
let booking: Booking | undefined;
let busy = false;
let connected = false;
let released = false;
let activeProject: ProjectIntent = 'planter-box';
let changedItemId: string | undefined;
let simulatedClockReceivedAt = Date.now();
const traffic: ProtocolEntry[] = [];

// A pair already names its two pieces, so ×2 would read as two pairs.
const showQuantity = (item: { name: string; quantity: number }) => item.quantity > 1 && !(item.quantity === 2 && /^Pair of /.test(item.name));

function say(message: string): void {
  if (!el<HTMLInputElement>('speak').checked || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const line = new SpeechSynthesisUtterance(message);
  line.lang = 'en-US';
  line.rate = 1;
  const voices = window.speechSynthesis.getVoices();
  line.voice = voices.find((voice) => /^en[-_]/i.test(voice.lang)) || null;
  window.speechSynthesis.speak(line);
}

function message(text: string, who: 'assistant' | 'user' = 'assistant', extra = ''): void {
  const block = document.createElement('article');
  block.className = `message message-${who}`;
  block.innerHTML = `<div class="message-author">${who === 'user' ? 'YOU' : 'BORROWMESH'}${who === 'assistant' ? '<span>✳</span>' : ''}</div><p>${esc(text)}</p>${extra}`;
  el('conversation').append(block);
  el('conversation').scrollTop = el('conversation').scrollHeight;
  if (who === 'assistant') say(text);
}

function log(entry: ProtocolEntry, persist = true): void {
  traffic.push(entry);
  const block = document.createElement('div');
  block.className = `protocol-entry ${entry.direction}`;
  block.innerHTML = `<div><b>${entry.direction === 'sent' ? '↑ CLIENT → SERVER' : '↓ SERVER → CLIENT'}</b><time>${esc(entry.time)}</time></div><pre>${esc(JSON.stringify(entry.message, null, 2))}</pre>`;
  el('protocol-log').append(block);
  el('protocol-count').innerHTML = `${traffic.length} messages <span aria-hidden="true">⌄</span>`;
  if (persist) {
    try { sessionStorage.setItem('borrowmesh-protocol', JSON.stringify(traffic.slice(-120))); }
    catch { /* The live inspector remains available when browser storage is full or disabled. */ }
  }
}

try {
  const saved = JSON.parse(sessionStorage.getItem('borrowmesh-protocol') || '[]') as ProtocolEntry[];
  if (Array.isArray(saved)) saved.slice(-120).filter((entry) => entry && ['sent', 'received'].includes(entry.direction) && entry.message).forEach((entry) => log(entry, false));
} catch { /* A fresh protocol log is enough if previous session storage is unavailable. */ }

function consent(request: ElicitRequest, signal?: AbortSignal): Promise<ElicitResult> {
  const dialog = el<HTMLDialogElement>('consent');
  el('consent-message').textContent = request.params.message;
  el<HTMLInputElement>('consent-confirm').checked = true;
  dialog.showModal();
  el('accept').focus();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (action: 'accept' | 'decline' | 'cancel') => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      dialog.removeEventListener('cancel', cancel);
      dialog.close();
      resolve(action === 'accept' ? { action, content: { consent: true } } : { action });
    };
    const abort = () => finish('cancel');
    const cancel = (event: Event) => { event.preventDefault(); finish('cancel'); };
    el('accept').onclick = () => finish(el<HTMLInputElement>('consent-confirm').checked ? 'accept' : 'decline');
    el('decline').onclick = () => finish('decline');
    el('cancel-consent').onclick = () => finish('cancel');
    dialog.addEventListener('cancel', cancel);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) finish('cancel');
  });
}

const mcp = new BorrowMeshClient(log, consent, () => {
  connected = false;
  el('connection').textContent = 'Server disconnected';
  el('connection').className = 'disconnected';
  updateDisabled();
});

function icon(item: CatalogItem): string {
  const paths: Record<string, string> = {
    drilling: '<path d="M7 10h15l5 5-5 5H7zM12 20v11h7V20M27 15h8M31 11v8"/>',
    cutting: '<path d="m5 25 23-16 6 8-22 16zM9 26l3 4m2-7 3 4m2-7 3 4m2-7 3 4M25 10l-3-4 8-2 6 8-2 5"/>',
    accessories: '<path d="m11 29 18-18M8 32l4 2 3-3-5-5-3 3zM27 13l-1-5 5-4 5 5-4 5z"/>',
    holding: '<path d="M12 7h16v7H19v16h9v5H12zM28 14v16M23 21h12M32 18v6"/>',
    safety: '<path d="M4 18h13v10H7zM23 18h13l-3 10H23zM17 21h6M4 18l-2-6m34 6 2-6"/>',
  };
  return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${paths[item.category]}</svg>`;
}

function time(value: string): string { return value.slice(0, 5); }
function deadline(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}`;
}

function renderBoard(): void {
  const bundle = booking?.status === 'booked' ? booking.bundle : hold?.status === 'active' ? hold.bundle : undefined;
  const status = booking?.status === 'booked' ? 'booked' : 'held';
  el('booking-status').textContent = bundle ? `${status === 'booked' ? 'Booked' : 'Held'} · ${bundle.items.length} items + bench` : released ? 'Released · all resources' : 'Ready to plan';
  el('booking-status').className = `board-status ${bundle ? status : released ? 'released' : ''}`;
  if (bundle) {
    el('kit-board').className = 'kit-board populated';
    el('kit-board').innerHTML = bundle.items.map((item) => {
      const substitute = item.id === changedItemId || bundle.substitutions.some((change) => change.replacement === item.id || change.replacement === item.name);
      const unavailable = item.condition !== 'ready';
      const tileStatus = unavailable ? 'out' : status;
      return `<article class="item-tile ${substitute ? 'is-substitute' : ''} ${unavailable ? 'has-issue' : ''}" data-item-id="${esc(item.id)}" data-status="${tileStatus}"><div class="tile-top">${icon(item)}<div class="tile-badges"><span class="item-status ${tileStatus}">${unavailable ? item.condition : status}</span>${substitute ? '<span class="substitute-label">Substitute</span>' : ''}</div></div><h3>${esc(item.name)}${showQuantity(item) ? ` <small>×${item.quantity}</small>` : ''}</h3><p>${unavailable ? 'Needs a compatible replacement' : `Return ${esc(deadline(bundle.returnDeadline))}`}</p></article>`;
    }).join('');
  } else {
    el('kit-board').className = 'kit-board';
    el('kit-board').innerHTML = `<div class="empty-board"><svg viewBox="0 0 180 100" fill="none" aria-hidden="true"><path d="M37 50h107l-8 43H45zM32 43h118v9H32zM46 68h91M48 82h87M63 43V18m0 11c-16 0-20-11-20-11 14-4 20 3 20 11Zm0-7c0-16 15-20 15-20 5 13-1 20-15 20ZM111 43V17m0 18c14 0 20-12 20-12-13-3-20 2-20 12Zm0-11c-14 0-18-12-18-12 13-2 18 4 18 12Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg><div><p class="eyebrow">${released ? 'READY FOR ANOTHER PROJECT' : 'FROM AN IDEA TO A WORKING SET'}</p><h3>${released ? 'Your booking is cancelled.' : 'Make room for your next project.'}</h3><p>${released ? 'Every item and the bench were released together.' : 'Tell us what you’re making. We’ll bring the right tools together.'}</p></div></div>`;
  }
  const start = bundle ? toMinutes(bundle.bench.start) : 0;
  const end = bundle ? toMinutes(bundle.bench.end) : 0;
  el('bench-timeline').innerHTML = `<div class="timeline-labels"><span>13:00</span><span>14:00</span><span>15:00</span><span>16:00</span><span>17:00</span></div><div class="timeline-track">${bundle ? `<div class="timeline-booking ${status}" style="left:${(start - 780) / 2.4}%;width:${(end - start) / 2.4}%">${esc(time(bundle.bench.start))}–${esc(time(bundle.bench.end))} · ${bundle.bench.outlet ? 'Outlet bench' : esc(bundle.bench.name)}</div>` : '<span class="timeline-empty">Choose a kit to hold its bench slot</span>'}</div>`;
  renderBundles();
  el('action-bar').innerHTML = hold?.status === 'active' && !booking ? `<span class="hold-note"><span class="pulse-dot"></span>Held until ${esc(deadline(hold.expiresAt))} <small>simulated time</small></span><button id="commit" data-testid="commit-button" class="primary-button">Book the complete kit <span>→</span></button>` : booking?.status === 'booked' ? `<span class="booking-note">✓ Every item and the bench are booked together.</span><button class="secondary-button" data-say="Cancel my booking">Cancel booking</button>` : '<span class="quiet-note">One hold. Every tool. Your bench, too.</span>';
  const commit = document.getElementById('commit');
  if (commit) commit.onclick = () => void submit('Book it');
  updateDisabled();
}

function toMinutes(value: string): number { const [hours, minutes] = value.split(':').map(Number); return hours! * 60 + minutes!; }

function renderBundles(): void {
  const compact = !bundles.length;
  el('comparison-heading').classList.toggle('is-hidden', compact);
  el('bundle-carousel').classList.toggle('is-compact', compact);
  el('bundle-carousel').setAttribute('aria-label', compact ? 'Kit summary' : 'Compare compatible kits');
  el('bundle-count').textContent = bundles.length ? `${bundles.length} compatible options` : 'Complete kits, compared';
  if (compact) {
    const current = booking?.status === 'booked' ? booking.bundle : hold?.status === 'active' ? hold.bundle : undefined;
    el('bundle-carousel').innerHTML = current
      ? `<p class="kit-summary"><strong>${booking ? 'Booked kit' : 'Held kit'}</strong> · ${esc(current.name)} · Return ${esc(deadline(current.returnDeadline))}</p>`
      : `<p class="kit-summary">${released ? 'Booking cancelled. Find a kit for another project.' : 'Find a kit to compare complete sets.'}</p>`;
    return;
  }
  el('bundle-carousel').innerHTML = bundles.map((bundle, index) => `<article class="bundle-card ${hold?.bundle.id === bundle.id || booking?.bundle.id === bundle.id ? 'selected' : ''}" data-testid="bundle-card-${index}"><div class="bundle-card-heading"><span class="option-number">0${index + 1}</span><span class="option-label">${index === 0 ? 'FIRST FIT' : 'ANOTHER WAY'}</span></div><h4>${esc(bundle.name)}</h4><p class="bundle-items">${bundle.items.map((item) => esc(item.name)).join(' · ')}</p><button class="bundle-detail-button" data-detail-index="${index}" data-testid="bundle-details-${index}">All ${bundle.items.length} items & ${bundle.substitutions.length} substitution${bundle.substitutions.length === 1 ? '' : 's'} ↗</button><div class="bundle-facts"><span>◷ ${esc(time(bundle.bench.start))}–${esc(time(bundle.bench.end))}</span><span>↩ ${esc(deadline(bundle.returnDeadline))}</span></div><button class="choose-button" data-testid="choose-bundle-${index}" data-bundle-index="${index}">${hold?.bundle.id === bundle.id ? 'Kit held ✓' : booking?.bundle.id === bundle.id ? 'Kit booked ✓' : 'Hold this complete kit'}<span>→</span></button></article>`).join('');
}

function showDetails(index: number): void {
  const bundle = bundles[index];
  if (!bundle) return;
  const itemName = (id: string) => library?.catalog.find((item) => item.id === id)?.name || id;
  el('kit-detail-content').innerHTML = `<p class="eyebrow">COMPLETE KIT / OPTION 0${index + 1}</p><h2 id="kit-detail-title">${esc(bundle.name)}</h2><h3>Every item, together</h3><ul class="detail-items">${bundle.items.map((item) => `<li>${esc(item.name)}${showQuantity(item) ? ` <span>×${item.quantity}</span>` : ''}</li>`).join('')}</ul><h3>Compatible substitutions</h3>${bundle.substitutions.length ? `<ul class="detail-substitutions">${bundle.substitutions.map((substitution) => `<li><strong>${esc(itemName(substitution.original))} → ${esc(itemName(substitution.replacement))}</strong><p>${esc(substitution.reason)}</p></li>`).join('')}</ul>` : '<p class="detail-copy">All requirements met without substitutions.</p>'}<div class="detail-bench"><p><strong>${esc(bundle.bench.name)}</strong> · ${esc(bundle.bench.date)} · ${esc(time(bundle.bench.start))}–${esc(time(bundle.bench.end))}</p><p>Return every item by ${esc(deadline(bundle.returnDeadline))} (simulated library time).</p></div>`;
  el<HTMLDialogElement>('kit-detail').showModal();
  el('close-kit-detail').focus();
}

function updateDisabled(): void {
  document.querySelectorAll<HTMLButtonElement>('button[data-say],button[data-bundle-index],#send,#commit,#reset').forEach((button) => { button.disabled = busy || !connected; });
  el<HTMLButtonElement>('connect').disabled = busy;
  el<HTMLInputElement>('utterance').disabled = !connected;
  el('send').textContent = busy ? '…' : '↑';
}

function absorb(result: ToolResponse): void {
  if (result.state && typeof result.state === 'object') {
    library = result.state as LibraryState;
    simulatedClockReceivedAt = Date.now();
    if (hold) hold = library.holds.find((candidate) => candidate.id === hold?.id && candidate.status === 'active');
    if (booking) booking = library.bookings.find((candidate) => candidate.id === booking?.id && candidate.status === 'booked');
  }
}

async function call(name: string, args: Record<string, unknown> = {}): Promise<ToolResponse> {
  const response = await mcp.call(name, args);
  absorb(response);
  return response;
}

async function handle(intent: Intent): Promise<void> {
  switch (intent.type) {
    case 'requirements': {
      activeProject = intent.project;
      const template = library?.templates.find((candidate) => candidate.id === activeProject);
      if (!template) { message('That project template is not available. Try the planter box.'); break; }
      message(`Here’s what you need for the ${template.name.toLowerCase()} project. Find a kit to check availability; nothing is reserved yet.`, 'assistant', `<div class="requirements-card"><div><strong>${esc(template.name)}</strong><span>Saturday · 13:00–17:00</span></div><ul>${template.requirements.map((requirement) => `<li>${esc(requirement)}</li>`).join('')}</ul><p>The platform-A cordless drill is out on loan. Let’s find a compatible alternative.</p></div>`);
      break;
    }
    case 'find': {
      activeProject = intent.project;
      const response = await call('find_compatible_kit', { project: activeProject, date: '2026-10-24', start: '13:00', end: '17:00' });
      bundles = (response.bundles as Bundle[] | undefined) || [];
      message(response.message);
      break;
    }
    case 'choose': {
      if (booking?.status === 'booked') { message('You already have a booked kit. Cancel it before reserving another complete set.'); break; }
      const chosen = bundles[intent.index];
      if (!chosen) { message('Find a kit first, then choose one of the visible options.'); break; }
      const response = await call('hold_resources', { bundleId: chosen.id });
      if (response.hold) { hold = response.hold as Hold; booking = undefined; released = false; changedItemId = undefined; }
      message(response.message);
      break;
    }
    case 'commit': {
      if (!hold || hold.status !== 'active') { message('Choose a kit first. I’ll hold every item and the bench together before booking.'); break; }
      const response = await call('commit_bundle', { holdId: hold.id });
      if (response.booking) { booking = response.booking as Booking; hold = undefined; bundles = []; }
      else if (response.ok === false && library) hold = library.holds.find((candidate) => candidate.id === hold?.id && candidate.status === 'active');
      if (response.alternatives) bundles = response.alternatives as Bundle[];
      message(response.message);
      break;
    }
    case 'booking': {
      const response = await call('get_booking', { bookingId: 'mine' });
      if (response.booking && (response.booking as Booking).status === 'booked') { booking = response.booking as Booking; hold = undefined; released = false; }
      else booking = undefined;
      message(response.message);
      break;
    }
    case 'issue': {
      if (!booking || booking.status !== 'booked') { message('There is no active booking to repair. Ask “What did I book?” to check.'); break; }
      const target = booking.bundle.items.find((item) => intent.target === 'clamps' ? item.attributes.role === 'clamps' || /clamp/i.test(item.name) : item.name.toLowerCase().includes(intent.target));
      if (!target) { message('That item is not in your booked kit. The rest of your booking stays in place.'); break; }
      const response = await call('report_issue', { bookingId: booking.id, itemId: target.id, kind: intent.kind });
      if (response.booking) booking = response.booking as Booking;
      if (response.replacement) changedItemId = (response.replacement as CatalogItem).id;
      message(response.message);
      break;
    }
    case 'release': {
      if (!booking || booking.status !== 'booked') { message('There is no active booking to cancel.'); break; }
      const response = await call('release_bundle', { bookingId: booking.id });
      if (response.ok !== false) { booking = undefined; hold = undefined; bundles = []; released = true; changedItemId = undefined; }
      message(response.message);
      break;
    }
    case 'reset': {
      const response = await call('reset_demo');
      booking = undefined; hold = undefined; bundles = []; released = false; changedItemId = undefined; activeProject = 'planter-box';
      el('conversation').replaceChildren();
      message(response.message);
      break;
    }
    case 'unknown': message('Try “What do I need to build a planter box?”, “Find me a kit”, “Choose the first kit”, or “What did I book?” This local demo supports the Saturday afternoon scenario.');
  }
}

async function submit(text: string): Promise<void> {
  if (busy || !connected || !text.trim()) return;
  message(text.trim(), 'user');
  el<HTMLInputElement>('utterance').value = '';
  busy = true;
  updateDisabled();
  try { await handle(routeIntent(text, activeProject)); }
  catch (error) { message(error instanceof Error ? error.message : 'The request could not be completed. Reconnect and try again.'); }
  finally { busy = false; renderBoard(); }
}

async function connect(): Promise<void> {
  busy = true;
  el('connection').textContent = 'Connecting…';
  updateDisabled();
  try {
    const info = await mcp.connect();
    connected = true;
    el('connection').textContent = 'Library connected';
    el('connection').className = 'connected';
    el('protocol-meta').textContent = `Protocol ${info.protocolVersion} · Session ${info.sessionId} · ${info.toolNames.length} tools · SDK client ↔ local MCP server`;
    await call('get_library_state');
    booking = library?.bookings.find((candidate) => candidate.borrowerId === library?.currentBorrowerId && candidate.status === 'booked');
    hold = booking ? undefined : library?.holds.find((candidate) => candidate.borrowerId === library?.currentBorrowerId && candidate.status === 'active' && candidate.expiresAt > (library?.simulatedNow || ''));
    if (booking) message('Welcome back. Your complete kit and bench booking are still here. Ask “What did I book?” for the details.');
    else if (!el('conversation').children.length) message('A good project starts with the right tools. Tell me what you want to make, and I’ll find a complete kit — bench included.');
  } catch (error) {
    connected = false;
    el('connection').textContent = 'Server unavailable';
    el('connection').className = 'disconnected';
    message(error instanceof Error ? error.message : 'The local library server is unavailable. Start npm run dev, then reconnect.');
  } finally { busy = false; renderBoard(); }
}

el<HTMLFormElement>('composer').onsubmit = (event) => { event.preventDefault(); void submit(el<HTMLInputElement>('utterance').value); };
app.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-say], button[data-bundle-index], button[data-detail-index]');
  if (!target || target.disabled) return;
  if (target.dataset.detailIndex) showDetails(Number(target.dataset.detailIndex));
  else if (target.dataset.say) void submit(target.dataset.say);
  else void submit(`Choose kit ${Number(target.dataset.bundleIndex) + 1}`);
});
el('close-kit-detail').onclick = () => el<HTMLDialogElement>('kit-detail').close();
el('connect').onclick = () => void connect();
el('reset').onclick = () => void submit('Reset the demo');
el<HTMLInputElement>('speak').onchange = () => { if (!el<HTMLInputElement>('speak').checked && 'speechSynthesis' in window) window.speechSynthesis.cancel(); };

interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
}
const speechWindow = window as Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const RecognitionConstructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
if (RecognitionConstructor) {
  const recognition = new RecognitionConstructor();
  recognition.lang = 'en-US'; recognition.interimResults = false; recognition.continuous = false;
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0].transcript).join(' ');
    el<HTMLInputElement>('utterance').value = transcript;
    el('voice-status').textContent = 'Speech captured. Review the text and press Send.';
    el<HTMLInputElement>('utterance').focus();
  };
  recognition.onerror = (event) => { el('voice-status').textContent = `Microphone unavailable: ${event.error}. Use the text box instead.`; };
  recognition.onend = () => { el('listen').textContent = 'Use microphone'; };
  el('listen').onclick = () => {
    try { recognition.start(); el('listen').textContent = 'Listening…'; el('voice-status').textContent = 'Listening. Browser speech recognition may use your browser’s speech service.'; }
    catch { el('voice-status').textContent = 'Microphone is already listening. Use the text box at any time.'; }
  };
  el('listen').title = 'Your browser may send speech to its recognition service. Captured text is reviewed before sending.';
} else {
  el<HTMLButtonElement>('listen').disabled = true;
  el('listen').textContent = 'Microphone unavailable';
  el('listen').title = 'Speech recognition is not supported in this browser. Use the text box or suggested requests.';
}
if (!('speechSynthesis' in window)) { el<HTMLInputElement>('speak').disabled = true; el('speak').title = 'Spoken replies are not supported in this browser.'; }
renderBoard();
void connect();
window.setInterval(() => {
  if (!hold || busy || !library) return;
  const simulatedNow = Date.parse(library.simulatedNow) + Date.now() - simulatedClockReceivedAt;
  if (Date.parse(hold.expiresAt) <= simulatedNow) {
    hold = undefined;
    message('Your temporary hold expired. Nothing was booked. Find a kit again to check the current availability.');
    renderBoard();
  }
}, 1000);
