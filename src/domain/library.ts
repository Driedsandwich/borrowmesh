import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Booking, Bundle, CatalogItem, CheckInRequest, Clock, CommitResult, FindResult, HoldResult, IssueResult, KitRequest, LibraryState, ReleaseResult, Substitution } from '../shared/types.js';
export type * from '../shared/types.js';

export const DEMO_DATE = '2026-10-24';
export const DEMO_NOW = `${DEMO_DATE}T12:00:00.000Z`;
const clone = <T>(value: T): T => structuredClone(value);
const stamp = (date: string, time: string): string => `${date}T${time}:00.000Z`;
const minutes = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const time = (value: number): string => `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
const intersects = (a: string, b: string, c: string, d: string): boolean => a < d && c < b;
const item = (id: string, name: string, category: CatalogItem['category'], role: string, attributes: Partial<CatalogItem['attributes']> = {}, quantity = 1): CatalogItem => ({ id, name, category, quantity, condition: 'ready', attributes: { role, ...attributes } });
const itemNameInSentence = (name: string): string => name.replace(/^Pair of /, '').replace(/^[A-Z]/, letter => letter.toLowerCase());

export function createInitialState(now = DEMO_NOW): LibraryState {
  return {
    schemaVersion: 1, libraryName: 'Maple Lane Tool Library', fictional: true, simulatedNow: now, currentBorrowerId: 'priya', sequence: 0,
    catalog: [
      item('saw-circular', 'Circular saw with wood blade', 'cutting', 'saw', { power: 'corded', blade: 'wood' }),
      item('saw-hand', 'Hand saw for wood', 'cutting', 'saw', { power: 'manual', blade: 'wood' }),
      item('drill-a', 'Cordless drill (18V platform A)', 'drilling', 'drill', { power: 'battery', platform: 'A', bitSizes: [3, 6], requires: ['battery-a'] }),
      item('drill-b', 'Cordless drill (18V platform B)', 'drilling', 'drill', { power: 'battery', platform: 'B', bitSizes: [3, 6], requires: ['battery-b'] }),
      item('drill-corded', 'Corded drill', 'drilling', 'drill', { power: 'corded', bitSizes: [3, 6], outletRequired: true, requires: ['extension'] }),
      item('battery-a', '18V battery (platform A)', 'accessories', 'battery', { platform: 'A' }),
      item('battery-b', '18V battery (platform B)', 'accessories', 'battery', { platform: 'B' }),
      item('bit-3', '3 mm wood drill bit', 'accessories', 'bit', { sizeMm: 3 }),
      item('bit-6', '6 mm wood drill bit', 'accessories', 'bit', { sizeMm: 6 }),
      item('extension', 'Extension cord', 'accessories', 'extension'),
      item('clamps-standard', 'Pair of standard clamps', 'holding', 'clamps', {}, 2),
      item('clamps-wide', 'Pair of wide-jaw clamps', 'holding', 'clamps', {}, 2),
      item('glasses', 'Safety glasses', 'safety', 'glasses'),
      item('sander', 'Hand sanding block', 'cutting', 'sander', { power: 'manual' }),
      item('dust-mask', 'Reusable dust mask', 'safety', 'mask'),
    ],
    borrowers: [{ id: 'priya', name: 'Priya' }, { id: 'jonas', name: 'Jonas' }, { id: 'mei', name: 'Mei' }],
    templates: [
      { id: 'planter-box', name: 'Planter box', description: 'Build a small wooden planter box.', preferredDrill: 'drill-a', durationMinutes: 120, requirements: ['Wood saw', 'Drill with compatible power source', '3 mm and 6 mm wood bits', '2 clamps', 'Safety glasses', 'Workshop bench slot'] },
      { id: 'shelf-repair', name: 'Shelf repair', description: 'Repair and refit a wooden shelf.', preferredDrill: 'drill-a', durationMinutes: 60, requirements: ['Drill with compatible power source', '3 mm and 6 mm wood bits', '2 clamps', 'Safety glasses', 'Workshop bench slot'] },
    ],
    bench: { id: 'bench-1', name: 'Workshop outlet bench', outlet: true, slotMinutes: 30 },
    loans: [
      { id: 'loan-a', borrowerId: 'mei', itemIds: ['drill-a', 'battery-a'], start: '2026-10-23T09:00:00.000Z', end: '2026-10-25T10:00:00.000Z' },
      { id: 'loan-b-morning', borrowerId: 'mei', itemIds: ['drill-b'], start: stamp(DEMO_DATE, '09:00'), end: stamp(DEMO_DATE, '15:00') },
    ],
    benchReservations: [{ id: 'bench-morning', borrowerId: 'mei', date: DEMO_DATE, start: '09:00', end: '14:00' }],
    bundles: [], holds: [], bookings: [],
    waitlist: [{ id: 'wait-jonas', borrowerId: 'jonas', request: { project: 'planter-box', date: DEMO_DATE, start: '13:00', end: '17:00' }, acceptsSubstitutions: true, status: 'waiting' }],
  };
}

/** A fictional clock that ticks with wall time and can also be advanced in tests. */
export class SimulatedClock implements Clock {
  private base: number; private started = Date.now();
  constructor(now: number | string = DEMO_NOW) { this.base = typeof now === 'string' ? Date.parse(now) : now; }
  now(): number { return this.base + Date.now() - this.started; }
  advance(minutesToAdvance: number): void { this.base += minutesToAdvance * 60_000; }
}

export function expireHolds(state: LibraryState, now: number | string = state.simulatedNow): LibraryState {
  const next = clone(state); next.simulatedNow = new Date(now).toISOString();
  for (const hold of next.holds) if (hold.status === 'active' && hold.expiresAt <= next.simulatedNow) hold.status = 'expired';
  return next;
}

function conflictsFor(state: LibraryState, bundle: Bundle, ignoreHold?: string, ignoreBooking?: string): string[] {
  const start = stamp(bundle.bench.date, bundle.bench.start); const end = bundle.returnDeadline;
  const conflicts = new Set<string>();
  for (const id of bundle.itemIds) {
    const found = state.catalog.find(value => value.id === id);
    if (!found || found.condition !== 'ready') conflicts.add(id);
    if (state.loans.some(loan => loan.itemIds.includes(id) && intersects(start, end, loan.start, loan.end))) conflicts.add(id);
    if (state.bookings.some(booking => booking.id !== ignoreBooking && booking.status === 'booked' && booking.bundle.itemIds.includes(id) && intersects(start, end, stamp(booking.bundle.bench.date, booking.bundle.bench.start), booking.bundle.returnDeadline))) conflicts.add(id);
    if (state.holds.some(hold => hold.id !== ignoreHold && hold.status === 'active' && hold.bundle.itemIds.includes(id) && intersects(start, end, stamp(hold.bundle.bench.date, hold.bundle.bench.start), hold.bundle.returnDeadline))) conflicts.add(id);
  }
  const benchEnd = stamp(bundle.bench.date, bundle.bench.end);
  if (state.benchReservations.some(slot => intersects(start, benchEnd, stamp(slot.date, slot.start), stamp(slot.date, slot.end)))) conflicts.add(state.bench.id);
  if (state.bookings.some(booking => booking.id !== ignoreBooking && booking.status === 'booked' && intersects(start, benchEnd, stamp(booking.bundle.bench.date, booking.bundle.bench.start), stamp(booking.bundle.bench.date, booking.bundle.bench.end)))) conflicts.add(state.bench.id);
  if (state.holds.some(hold => hold.id !== ignoreHold && hold.status === 'active' && intersects(start, benchEnd, stamp(hold.bundle.bench.date, hold.bundle.bench.start), stamp(hold.bundle.bench.date, hold.bundle.bench.end)))) conflicts.add(state.bench.id);
  return [...conflicts];
}

export function isCompatibleKit(items: CatalogItem[], project = 'planter-box', outlet = true): boolean {
  const drill = items.find(value => value.attributes.role === 'drill');
  if (!drill || ![3, 6].every(size => drill.attributes.bitSizes?.includes(size) && items.some(value => value.attributes.role === 'bit' && value.attributes.sizeMm === size))) return false;
  if (drill.attributes.outletRequired && !outlet) return false;
  if (!(drill.attributes.requires ?? []).every(id => items.some(value => value.id === id))) return false;
  if (drill.attributes.power === 'battery' && !items.some(value => value.attributes.role === 'battery' && value.attributes.platform === drill.attributes.platform)) return false;
  return (project !== 'planter-box' || items.some(value => value.attributes.role === 'saw' && value.attributes.blade === 'wood')) && items.some(value => value.attributes.role === 'clamps' && value.quantity >= 2) && items.some(value => value.attributes.role === 'glasses');
}

function kitName(items: CatalogItem[]): string {
  const drill = items.find(value => value.attributes.role === 'drill')!;
  const power = drill.attributes.power === 'corded' ? 'Plug-in kit' : `Battery kit · platform ${drill.attributes.platform}`;
  const clamps = items.find(value => value.attributes.role === 'clamps')!;
  const saw = items.some(value => value.attributes.role === 'saw' && value.attributes.power === 'manual') ? ' · hand saw' : '';
  return `${power} · ${clamps.name.replace(/^Pair of /, '')}${saw}`;
}

export function findCompatibleKits(input: LibraryState, request: KitRequest): FindResult {
  const state = expireHolds(input);
  const project = request.project.toLowerCase().replace(/\s+/g, '-');
  const template = state.templates.find(value => value.id === project);
  if (!template) return { state, ok: false, message: 'Choose planter-box or shelf-repair.', bundles: [], requirements: [] };
  const parsedDate = new Date(`${request.date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== request.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(request.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(request.end) || minutes(request.start) >= minutes(request.end)) return { state, ok: false, message: 'Use a valid date and an increasing HH:MM time window.', bundles: [], requirements: template.requirements };
  const normalized = { ...request, project };
  const candidates: Bundle[] = [];
  const saws = project === 'planter-box' ? ['saw-circular', 'saw-hand'] : [undefined];
  for (const drillId of ['drill-corded', 'drill-b', 'drill-a']) for (const sawId of saws) for (const clampId of ['clamps-standard', 'clamps-wide']) {
    const drill = state.catalog.find(value => value.id === drillId)!;
    const ids = [...(sawId ? [sawId] : []), drillId, ...(drill.attributes.requires ?? []), 'bit-3', 'bit-6', clampId, 'glasses'];
    const items = ids.map(id => state.catalog.find(value => value.id === id)!);
    if (!isCompatibleKit(items, project, state.bench.outlet)) continue;
    const substitutions: Substitution[] = [];
    if (drillId !== template.preferredDrill) substitutions.push({ original: 'Cordless drill (18V platform A)', replacement: drill.name, reason: drillId === 'drill-corded' ? 'Uses a compatible corded drill instead of platform A; it needs the outlet bench and an extension cord.' : 'Uses a compatible platform B drill instead of platform A, together with its matching 18V battery.' });
    if (sawId === 'saw-hand') substitutions.push({ original: 'Circular saw with wood blade', replacement: 'Hand saw for wood', reason: 'A wood-cutting hand saw is a compatible manual alternative.' });
    if (clampId === 'clamps-wide') substitutions.push({ original: 'Pair of standard clamps', replacement: 'Pair of wide-jaw clamps', reason: 'The wide-jaw pair still provides both required clamps.' });
    const duration = template.durationMinutes + (drillId === 'drill-corded' ? 30 : 0);
    for (let start = Math.ceil(minutes(request.start) / 30) * 30; start + duration <= minutes(request.end); start += 30) {
      const end = start + duration;
      const returnAt = Math.min(end + 30, minutes(request.end));
      const changes = [drillId === 'drill-corded' ? 'a corded drill that needs the outlet bench' : '', sawId === 'saw-hand' ? 'a manual hand saw instead of the circular saw' : ''].filter(Boolean);
      const bundle: Bundle = { id: `kit-${project}-${request.date}-${drillId}-${sawId ?? 'none'}-${clampId}-${start}`, project, borrowerId: state.currentBorrowerId, name: kitName(items), itemIds: ids, items: clone(items), substitutions, bench: { ...state.bench, date: request.date, start: time(start), end: time(end) }, returnDeadline: stamp(request.date, time(returnAt)), requiresConsent: changes.length > 0, ...(changes.length ? { consentReason: `This bundle uses ${changes.join(' and ')}. Accept?` } : {}), score: [substitutions.length, start, returnAt - start], request: normalized };
      if (!conflictsFor(state, bundle).length) { candidates.push(bundle); break; }
    }
  }
  candidates.sort((a, b) => a.score[0] - b.score[0] || a.score[1] - b.score[1] || a.score[2] - b.score[2] || a.id.localeCompare(b.id));
  const bundles = candidates.slice(0, 3);
  for (const bundle of bundles) { state.bundles = state.bundles.filter(value => value.id !== bundle.id); state.bundles.push(bundle); }
  return { state, ok: bundles.length > 0, message: bundles.length ? `I found ${bundles.length} complete, compatible kits. Each includes the required tools, matching accessories, two clamps, safety glasses, and a bench slot.` : 'No complete kit fits that window. Nothing has been reserved.', bundles, requirements: template.requirements };
}

export function holdResources(input: LibraryState, bundleId: string): HoldResult {
  const state = expireHolds(input); const bundle = state.bundles.find(value => value.id === bundleId);
  if (!bundle) return { state, ok: false, message: 'That bundle was not found. Find a kit again.' };
  const conflicts = conflictsFor(state, bundle);
  if (conflicts.length) return { state, ok: false, message: `Nothing was held. Unavailable resources: ${conflicts.join(', ')}.`, conflicts };
  state.sequence++;
  const hold = { id: `hold-${randomUUID()}`, bundle: clone(bundle), borrowerId: state.currentBorrowerId, createdAt: state.simulatedNow, expiresAt: new Date(Date.parse(state.simulatedNow) + 10 * 60_000).toISOString(), status: 'active' as const };
  state.holds.push(hold); return { state, ok: true, message: 'The complete kit and bench are held for 10 simulated minutes. Confirm to book them together.', hold };
}

export function commitBundle(input: LibraryState, holdId: string, consent?: boolean): CommitResult {
  const state = expireHolds(input); const hold = state.holds.find(value => value.id === holdId);
  if (!hold || hold.status !== 'active') return { state, ok: false, message: 'This hold is missing or no longer active. Nothing was booked.' };
  if (hold.bundle.requiresConsent && consent === undefined) return { state, ok: false, message: hold.bundle.consentReason!, needsConsent: true, consentReason: hold.bundle.consentReason };
  if (hold.bundle.requiresConsent && consent !== true) { hold.status = 'cancelled'; return { state, ok: false, message: 'The substitution was declined or cancelled. Nothing was booked; the hold is released.' }; }
  const conflicts = conflictsFor(state, hold.bundle, hold.id);
  if (conflicts.length) {
    hold.status = 'cancelled'; const alternatives = findCompatibleKits(state, hold.bundle.request);
    return { state: alternatives.state, ok: false, message: `Atomic commit stopped: ${conflicts.join(', ')} became unavailable. Nothing was booked.`, conflicts, alternatives: alternatives.bundles };
  }
  state.sequence++;
  const booking: Booking = { id: `booking-${randomUUID()}`, borrowerId: hold.borrowerId, bundle: clone(hold.bundle), status: 'booked', createdAt: state.simulatedNow, issues: [] };
  hold.status = 'committed'; state.bookings.push(booking);
  return { state, ok: true, message: `I booked the complete kit and bench for ${booking.bundle.bench.start}–${booking.bundle.bench.end}. Return every item by ${booking.bundle.returnDeadline.slice(11, 16)}.`, booking };
}

export function releaseBundle(input: LibraryState, bookingId: string): ReleaseResult {
  let state = expireHolds(input); const booking = state.bookings.find(value => value.id === bookingId);
  if (!booking || booking.status !== 'booked') return { state, ok: false, message: 'An active booking with that ID was not found.', waitlistServed: [] };
  booking.status = 'cancelled'; const released = clone(booking); const waitlistServed: Booking[] = [];
  for (const entry of state.waitlist.filter(value => value.status === 'waiting')) {
    const priorBorrower = state.currentBorrowerId; state.currentBorrowerId = entry.borrowerId;
    const search = findCompatibleKits(state, entry.request); state = search.state;
    const bundle = search.bundles.find(value => !value.requiresConsent || entry.acceptsSubstitutions);
    if (bundle) {
      // The fictional waitlist records whether compatible substitutions were accepted.
      const held = holdResources(state, bundle.id); state = held.state;
      if (held.hold) {
        const committed = commitBundle(state, held.hold.id, entry.acceptsSubstitutions); state = committed.state;
        if (committed.booking) { const updatedEntry = state.waitlist.find(value => value.id === entry.id)!; updatedEntry.status = 'served'; updatedEntry.bookingId = committed.booking.id; waitlistServed.push(committed.booking); }
      }
    }
    state.currentBorrowerId = priorBorrower;
  }
  const waitlistMessage = waitlistServed.length ? waitlistServed.map(value => `${state.borrowers.find(borrower => borrower.id === value.borrowerId)?.name ?? 'A borrower'}, on the waitlist, now has a complete booking.`).join(' ') : 'No one on the waitlist can book a complete kit yet.';
  return { state, ok: true, message: `All items and the bench were released together. ${waitlistMessage}`, released, waitlistServed };
}

export function reportIssue(input: LibraryState, bookingId: string, itemId: string, kind: 'broken' | 'late'): IssueResult {
  const state = expireHolds(input); const booking = state.bookings.find(value => value.id === bookingId && value.status === 'booked');
  if (!booking || !booking.bundle.itemIds.includes(itemId)) return { state, ok: false, message: 'That item is not part of the active booking.' };
  const affected = state.catalog.find(value => value.id === itemId)!; affected.condition = kind;
  // A booking contains item snapshots; keep the reported condition truthful
  // even when there is no compatible spare to swap into this booking.
  booking.bundle.items = booking.bundle.items.map(value => value.id === itemId ? clone(affected) : value);
  const keptItemIds = booking.bundle.itemIds.filter(id => id !== itemId);
  const replacement = state.catalog.find(candidate => {
    if (candidate.id === itemId || candidate.condition !== 'ready' || candidate.attributes.role !== affected.attributes.role || candidate.quantity < affected.quantity) return false;
    const testBundle = { ...booking.bundle, itemIds: [...keptItemIds, candidate.id] };
    const testItems = testBundle.itemIds.map(id => state.catalog.find(value => value.id === id)!);
    return isCompatibleKit(testItems, booking.bundle.project, booking.bundle.bench.outlet) && !conflictsFor(state, testBundle, undefined, booking.id).length;
  });
  booking.issues.push({ itemId, kind, ...(replacement ? { replacementId: replacement.id } : {}) });
  if (!replacement) return { state, ok: false, message: `The ${kind} item was flagged. No compatible single-item replacement is available; all other reservations are kept.`, booking, affectedItemId: itemId, keptItemIds };
  booking.bundle.itemIds = booking.bundle.itemIds.map(id => id === itemId ? replacement.id : id);
  booking.bundle.items = booking.bundle.itemIds.map(id => clone(state.catalog.find(value => value.id === id)!));
  booking.bundle.name = kitName(booking.bundle.items);
  booking.bundle.substitutions.push({ original: affected.name, replacement: replacement.name, reason: `${affected.name} was reported ${kind}. Only this item was replaced; the remaining kit and bench are kept.` });
  return { state, ok: true, message: `I swapped your ${itemNameInSentence(affected.name)} for the ${itemNameInSentence(replacement.name)}. Every other item and the bench stay booked.`, booking, replacement: clone(replacement), affectedItemId: itemId, keptItemIds };
}

export function check_in_bundle(_state: LibraryState, _request: CheckInRequest): never { throw new Error('check_in_bundle not implemented'); }

export class LibraryStore {
  private state = createInitialState(); private clock: Clock; private customClock: boolean;
  constructor(private file: string, clock?: Clock) { this.customClock = !!clock; this.clock = clock ?? new SimulatedClock(); }
  async load(): Promise<LibraryState> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.file, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || (parsed as LibraryState).schemaVersion !== 1 || !Array.isArray((parsed as LibraryState).catalog) || !Array.isArray((parsed as LibraryState).bookings)) throw new Error('Invalid BorrowMesh state file; refusing to replace it.');
      this.state = parsed as LibraryState;
      if (!this.customClock) this.clock = new SimulatedClock(Date.parse(this.state.simulatedNow) + (this.state.savedAtWallTime ? Math.max(0, Date.now() - this.state.savedAtWallTime) : 0));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await this.save(createInitialState(new Date(this.clock.now()).toISOString()));
    }
    this.state = expireHolds(this.state, this.clock.now()); return this.snapshot();
  }
  snapshot(): LibraryState { this.state = expireHolds(this.state, this.clock.now()); return clone(this.state); }
  async save(state: LibraryState): Promise<void> {
    const next = expireHolds(state, this.clock.now()); next.savedAtWallTime = Date.now(); await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, this.file); this.state = clone(next);
  }
  async reset(): Promise<LibraryState> { if (!this.customClock) this.clock = new SimulatedClock(); await this.save(createInitialState(new Date(this.clock.now()).toISOString())); return this.snapshot(); }
}
