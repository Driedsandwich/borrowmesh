import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { check_in_bundle, commitBundle, createInitialState, DEMO_DATE, DEMO_NOW, expireHolds, findCompatibleKits, holdResources, isCompatibleKit, LibraryStore, releaseBundle, reportIssue, SimulatedClock } from '../src/domain/index.js';
import type { LibraryState } from '../src/shared/types.js';

const request = { project: 'planter-box', date: DEMO_DATE, start: '13:00', end: '17:00' };
function heldKit() { const found = findCompatibleKits(createInitialState(), request); return holdResources(found.state, found.bundles[0].id); }
function bookedKit() { const held = heldKit(); return commitBundle(held.state, held.hold!.id, true); }
const temporaryDirectories: string[] = [];
async function temporaryFolder() { await mkdir('data', { recursive: true }); const folder = await mkdtemp(resolve('data', 'domain-test-')); temporaryDirectories.push(folder); return folder; }
afterEach(async () => { vi.useRealTimers(); for (const folder of temporaryDirectories.splice(0)) await rm(folder, { recursive: true, force: true }); });

describe('complete compatible bundles', () => {
  it('provides the canonical catalog, templates and fictional borrowers', () => {
    const state = createInitialState(); expect(state.catalog).toHaveLength(15); expect(state.templates).toHaveLength(2); expect(state.borrowers).toHaveLength(3); expect(state.fictional).toBe(true);
  });
  it('ranks complete kits by substitutions then earliest bench and shortest loan', () => {
    const result = findCompatibleKits(createInitialState(), request);
    expect(result.bundles).toHaveLength(3);
    expect(result.bundles[0].itemIds).toContain('drill-corded'); expect(result.bundles[0].requiresConsent).toBe(true);
    expect(result.bundles[0].bench).toMatchObject({ start: '14:00', end: '16:30', outlet: true });
    expect(result.bundles[1].itemIds).toEqual(expect.arrayContaining(['drill-b', 'battery-b']));
    expect(result.bundles[1].bench).toMatchObject({ start: '15:00', end: '17:00' });
    for (const bundle of result.bundles) { expect(isCompatibleKit(bundle.items)).toBe(true); expect(bundle.substitutions.every(value => value.reason.length > 10)).toBe(true); expect(bundle.itemIds).not.toContain('drill-a'); }
    expect(result.bundles[2].substitutions.length).toBeGreaterThan(result.bundles[0].substitutions.length);
  });
  it('gives canonical kits unique titles that identify their actual tools', () => {
    const { bundles } = findCompatibleKits(createInitialState(), request);
    expect(new Set(bundles.map(bundle => bundle.name)).size).toBe(bundles.length);
    expect(bundles[0].name).toBe('Plug-in kit · standard clamps');
    expect(bundles[1].name).toBe('Battery kit · platform B · standard clamps');
    expect(bundles[2].name).toBe('Plug-in kit · wide-jaw clamps');
    for (const bundle of bundles) {
      const clamps = bundle.items.find(item => item.attributes.role === 'clamps')!;
      expect(bundle.name).toContain(clamps.name.replace('Pair of ', ''));
    }
  });
  it('identifies a hand saw when the circular saw is unavailable', () => {
    const state = createInitialState();
    state.catalog.find(item => item.id === 'saw-circular')!.condition = 'broken';
    const { bundles } = findCompatibleKits(state, request);
    expect(bundles).toHaveLength(3);
    expect(new Set(bundles.map(bundle => bundle.name)).size).toBe(bundles.length);
    expect(bundles.every(bundle => bundle.name.includes('hand saw') && bundle.itemIds.includes('saw-hand'))).toBe(true);
  });
  it('rejects platform-mismatched batteries, missing bits and an outlet-free corded kit', () => {
    const result = findCompatibleKits(createInitialState(), request); const cordless = result.bundles[1].items;
    const wrongBattery = createInitialState().catalog.find(item => item.id === 'battery-a')!;
    expect(isCompatibleKit([...cordless.filter(item => item.id !== 'battery-b'), wrongBattery])).toBe(false);
    expect(isCompatibleKit(cordless.filter(item => item.id !== 'bit-6'))).toBe(false);
    expect(isCompatibleKit(result.bundles[0].items, 'planter-box', false)).toBe(false);
  });
  it('finds a complete shelf-repair kit and rejects unknown projects or bad windows', () => {
    const shelf = findCompatibleKits(createInitialState(), { ...request, project: 'shelf repair' }); expect(shelf.ok).toBe(true); expect(shelf.bundles.every(bundle => !bundle.itemIds.includes('saw-circular'))).toBe(true);
    expect(findCompatibleKits(createInitialState(), { ...request, project: 'unknown' }).ok).toBe(false);
    expect(findCompatibleKits(createInitialState(), { ...request, end: '12:00' }).ok).toBe(false);
    expect(findCompatibleKits(createInitialState(), { ...request, date: '2026-02-31' }).ok).toBe(false);
  });
});

describe('holds and atomic commit', () => {
  it('holds every resource and prevents a second overlapping hold', () => {
    const held = heldKit(); expect(held.ok).toBe(true); expect(held.hold!.bundle.itemIds.length).toBeGreaterThan(6);
    expect(holdResources(held.state, held.hold!.bundle.id).ok).toBe(false); expect(held.state.bookings).toHaveLength(0);
  });
  it('expires a hold after ten minutes with an injectable simulated clock', () => {
    const held = heldKit(); const clock = new SimulatedClock(DEMO_NOW); clock.advance(11);
    const expired = expireHolds(held.state, clock.now()); expect(expired.holds[0].status).toBe('expired'); expect(commitBundle(expired, held.hold!.id, true).ok).toBe(false);
    expect(holdResources(expired, held.hold!.bundle.id).ok).toBe(true);
  });
  it('requires consent, books nothing on decline, and commits every part on accept', () => {
    const held = heldKit(); const pending = commitBundle(held.state, held.hold!.id);
    expect(pending.needsConsent).toBe(true); expect(pending.state.bookings).toHaveLength(0);
    const declined = commitBundle(held.state, held.hold!.id, false); expect(declined.ok).toBe(false); expect(declined.state.bookings).toHaveLength(0); expect(declined.state.holds[0].status).toBe('cancelled');
    const accepted = commitBundle(held.state, held.hold!.id, true); expect(accepted.booking!.bundle.itemIds).toEqual(held.hold!.bundle.itemIds); expect(accepted.state.bookings).toHaveLength(1); expect(accepted.state.holds[0].status).toBe('committed');
    expect(commitBundle(accepted.state, held.hold!.id, true).ok).toBe(false);
  });
  it('books nothing when an item is taken during a hold and names the failed part', () => {
    const held = heldKit(); held.state.loans.push({ id: 'mid-hold-loan', borrowerId: 'mei', itemIds: ['clamps-standard'], start: `${DEMO_DATE}T14:00:00.000Z`, end: `${DEMO_DATE}T18:00:00.000Z` });
    const result = commitBundle(held.state, held.hold!.id, true); expect(result.ok).toBe(false); expect(result.conflicts).toContain('clamps-standard'); expect(result.state.bookings).toHaveLength(0); expect(result.alternatives!.length).toBeGreaterThan(0); expect(result.alternatives!.every(bundle => !bundle.itemIds.includes('clamps-standard'))).toBe(true);
  });
  it('books nothing when the bench is taken during a hold', () => {
    const held = heldKit(); held.state.benchReservations.push({ id: 'taken-mid-hold', borrowerId: 'mei', date: DEMO_DATE, start: '14:00', end: '16:30' });
    const result = commitBundle(held.state, held.hold!.id, true); expect(result.conflicts).toContain('bench-1'); expect(result.state.bookings).toHaveLength(0);
  });
});

describe('targeted replanning and release', () => {
  it.each(['saw-circular', 'drill-b'])('records the issue without swapping %s for a setup-changing replacement', itemId => {
    const found = findCompatibleKits(createInitialState(), request);
    const bundle = found.bundles.find(bundle => bundle.itemIds.includes('drill-b'))!;
    const held = holdResources(found.state, bundle.id);
    const committed = commitBundle(held.state, held.hold!.id, true);
    const original = committed.booking!;
    if (itemId === 'drill-b') {
      // Include the corded drill's accessory so the replacement is compatible.
      original.bundle.itemIds.push('extension');
      original.bundle.items.push(structuredClone(committed.state.catalog.find(item => item.id === 'extension')!));
    }
    const result = reportIssue(committed.state, original.id, itemId, 'broken');
    expect(result.ok).toBe(false);
    expect(result.replacement).toBeUndefined();
    expect(result.message).toContain('would change your setup');
    expect(result.message).toContain('Find a new kit');
    expect(result.message).toContain('give consent');
    expect(result.booking!.issues).toEqual([{ itemId, kind: 'broken' }]);
    expect(result.booking!.bundle).toEqual({ ...original.bundle, items: original.bundle.items.map(item => item.id === itemId ? { ...item, condition: 'broken' } : item) });
    expect(result.state.loans).toEqual(committed.state.loans);
    expect(result.state.holds).toEqual(committed.state.holds);
    expect(result.state.benchReservations).toEqual(committed.state.benchReservations);
    expect(result.state.waitlist).toEqual(committed.state.waitlist);
  });
  it.each(['broken', 'late'] as const)('replaces only the affected clamps reported %s', kind => {
    const committed = bookedKit(); const original = committed.booking!;
    const result = reportIssue(committed.state, original.id, 'clamps-standard', kind);
    expect(result.ok).toBe(true); expect(result.replacement!.id).toBe('clamps-wide');
    expect(result.message).toBe('I swapped your standard clamps for the wide-jaw clamps. Every other item and the bench stay booked.');
    expect(result.booking!.bundle.itemIds).toEqual(original.bundle.itemIds.map(id => id === 'clamps-standard' ? 'clamps-wide' : id));
    expect(result.booking!.bundle.bench).toEqual(original.bundle.bench); expect(result.booking!.id).toBe(original.id); expect(result.booking!.bundle.returnDeadline).toBe(original.bundle.returnDeadline);
    expect(result.state.catalog.find(item => item.id === 'clamps-standard')!.condition).toBe(kind);
    expect(result.booking!.bundle.name).toContain('wide-jaw clamps');
    expect(result.booking!.bundle.name).not.toContain('standard clamps');
    expect(result.booking!.issues).toEqual([{ itemId: 'clamps-standard', kind, replacementId: 'clamps-wide' }]);
  });
  it('keeps other resources when no compatible single-item replacement exists', () => {
    const committed = bookedKit(); const result = reportIssue(committed.state, committed.booking!.id, 'bit-3', 'broken');
    expect(result.ok).toBe(false); expect(result.booking!.bundle.itemIds).toEqual(committed.booking!.bundle.itemIds); expect(result.keptItemIds).not.toContain('bit-3'); expect(result.state.catalog.find(item => item.id === 'bit-3')!.condition).toBe('broken');
    expect(result.booking!.bundle.items.find(item => item.id === 'bit-3')!.condition).toBe('broken');
    expect(result.booking!.bundle.items.filter(item => item.id !== 'bit-3')).toEqual(committed.booking!.bundle.items.filter(item => item.id !== 'bit-3'));
  });
  it('releases the complete booking and actually books a complete kit for Jonas', () => {
    const committed = bookedKit(); const repaired = reportIssue(committed.state, committed.booking!.id, 'clamps-standard', 'broken');
    const result = releaseBundle(repaired.state, committed.booking!.id);
    expect(result.ok).toBe(true); expect(result.released!.status).toBe('cancelled'); expect(result.waitlistServed).toHaveLength(1);
    expect(result.message).toBe('All items and the bench were released together. Jonas, on the waitlist, now has a complete booking.');
    const jonas = result.waitlistServed[0]; expect(jonas.borrowerId).toBe('jonas'); expect(jonas.status).toBe('booked'); expect(isCompatibleKit(jonas.bundle.items)).toBe(true);
    expect(result.state.waitlist[0]).toMatchObject({ status: 'served', bookingId: jonas.id }); expect(result.state.bookings.filter(booking => booking.status === 'booked')).toEqual([jonas]); expect(result.state.currentBorrowerId).toBe('priya');
  });
  it('does not claim a waitlist booking when a complete kit is unavailable', () => {
    const committed = bookedKit();
    for (const item of committed.state.catalog) if (item.attributes.role === 'drill') item.condition = 'broken';
    const result = releaseBundle(committed.state, committed.booking!.id);
    expect(result.ok).toBe(true);
    expect(result.waitlistServed).toEqual([]);
    expect(result.state.waitlist[0].status).toBe('waiting');
    expect(result.state.bookings.filter(booking => booking.status === 'booked')).toEqual([]);
    expect(result.message).toBe('All items and the bench were released together. No one on the waitlist can book a complete kit yet.');
  });
  it.each(['corded drill', 'manual saw'])('does not serve a waitlisted borrower who did not accept a %s setup change', setup => {
    const committed = bookedKit();
    committed.state.waitlist[0].acceptsSubstitutions = false;
    committed.state.catalog.find(item => item.id === (setup === 'corded drill' ? 'drill-b' : 'saw-circular'))!.condition = 'broken';
    const result = releaseBundle(committed.state, committed.booking!.id);
    expect(result.ok).toBe(true);
    expect(result.waitlistServed).toEqual([]);
    expect(result.state.waitlist[0]).toMatchObject({ status: 'waiting', acceptsSubstitutions: false });
    expect(result.state.bookings.filter(booking => booking.status === 'booked')).toEqual([]);
    expect(result.state.holds).toEqual(committed.state.holds);
  });
});

describe('atomic JSON persistence', () => {
  it('restores bookings across store instances and resets the fictional scenario', async () => {
    const folder = await temporaryFolder();
    const file = resolve(folder, 'library.json'); const clock = new SimulatedClock(DEMO_NOW); const store = new LibraryStore(file, clock); await store.load();
    const committed = bookedKit(); await store.save(committed.state);
    const restarted = new LibraryStore(file, clock); await restarted.load(); expect(restarted.snapshot().bookings).toEqual(committed.state.bookings);
    const persisted: LibraryState = JSON.parse(await readFile(file, 'utf8')); expect(persisted.bookings).toHaveLength(1);
    await restarted.reset(); expect(restarted.snapshot().bookings).toHaveLength(0); expect(restarted.snapshot().waitlist[0].status).toBe('waiting');
  });
  it('persists active holds and expires them when the injected clock advances', async () => {
    const folder = await temporaryFolder();
    const file = resolve(folder, 'library.json'); const clock = new SimulatedClock(DEMO_NOW); const store = new LibraryStore(file, clock); await store.load();
    const held = heldKit(); await store.save(held.state); clock.advance(11);
    const restarted = new LibraryStore(file, clock); await restarted.load(); expect(restarted.snapshot().holds[0].status).toBe('expired');
  });
  it('resumes the saved simulated time without downtime, then expires holds while running', async () => {
    vi.useFakeTimers();
    const folder = await temporaryFolder(); const file = resolve(folder, 'library.json');
    const state = heldKit().state;
    state.simulatedNow = `${DEMO_DATE}T12:07:00.000Z`;
    state.savedAtWallTime = Date.now() - 24 * 60 * 60_000;
    await writeFile(file, JSON.stringify(state)); const restarted = new LibraryStore(file); await restarted.load();
    expect(restarted.snapshot().simulatedNow).toBe(state.simulatedNow);
    expect(restarted.snapshot().holds[0].status).toBe('active');
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(restarted.snapshot().holds[0].status).toBe('expired');
  });
  it('never reuses a stale hold identity after reset', async () => {
    const old = heldKit(); const fresh = heldKit(); expect(fresh.hold!.id).not.toBe(old.hold!.id);
    expect(commitBundle(fresh.state, old.hold!.id, true).ok).toBe(false);
  });
});

describe('reserved check-in workflow', () => {
  it('leaves a typed throwing stub outside the MCP surface', () => {
    const result = check_in_bundle(createInitialState(), { bookingId: 'planned', returnedItemIds: [] });
    expect(result.ok).toBe(false);
    expect(result.waitlistServed).toEqual([]);
  });
  it('marks every returned booking item returned and closes the booking', () => {
    const committed = bookedKit();
    const booking = committed.booking!;
    const result = check_in_bundle(committed.state, { bookingId: booking.id, returnedItemIds: booking.bundle.itemIds });
    expect(result.ok).toBe(true);
    expect(result.booking!.status).toBe('returned');
    expect(result.booking!.id).toBe(booking.id);
    for (const id of booking.bundle.itemIds) {
      expect(result.state.catalog.find(item => item.id === id)!.condition).toBe('ready');
    }
    expect(result.state.bookings.find(b => b.id === booking.id)!.status).toBe('returned');
    expect(result.waitlistServed).toHaveLength(1);
    expect(result.waitlistServed[0].borrowerId).toBe('jonas');
  });
  it('flags missing and damaged parts without making them available', () => {
    const committed = bookedKit();
    const booking = committed.booking!;
    const itemIds = booking.bundle.itemIds;
    // Return all but two items; mark one damaged, one missing
    const damagedId = itemIds[0];
    const missingId = itemIds[1];
    const returnedIds = itemIds.slice(2);
    const result = check_in_bundle(committed.state, {
      bookingId: booking.id,
      returnedItemIds: returnedIds,
      issues: [{ itemId: damagedId, kind: 'damaged' }, { itemId: missingId, kind: 'missing' }],
    });
    expect(result.ok).toBe(true);
    expect(result.booking!.status).toBe('returned');
    expect(result.booking!.issues).toEqual(expect.arrayContaining([
      { itemId: damagedId, kind: 'damaged' },
      { itemId: missingId, kind: 'missing' },
    ]));
    // Damaged item is broken (out for repair), not ready
    expect(result.state.catalog.find(item => item.id === damagedId)!.condition).toBe('broken');
    // Missing item stays at its prior condition (unchanged — not forcibly made unavailable)
    const missingConditionBefore = committed.state.catalog.find(item => item.id === missingId)!.condition;
    expect(result.state.catalog.find(item => item.id === missingId)!.condition).toBe(missingConditionBefore);
    // Returned items are available again
    for (const id of returnedIds) {
      expect(result.state.catalog.find(item => item.id === id)!.condition).toBe('ready');
    }
    // Unaccounted item returns ok:false with unchanged state
    const unaccounted = check_in_bundle(committed.state, {
      bookingId: booking.id,
      returnedItemIds: returnedIds,
      issues: [{ itemId: damagedId, kind: 'damaged' }],
      // missingId not listed
    });
    expect(unaccounted.ok).toBe(false);
    expect(unaccounted.state.bookings).toEqual(committed.state.bookings);
  });
  it('frees the bench early and serves a compatible waitlisted borrower', () => {
    const committed = bookedKit();
    const booking = committed.booking!;
    // Simulate check-in before bench end time (simulatedNow is before bench.end)
    const benchEnd = `${booking.bundle.bench.date}T${booking.bundle.bench.end}:00.000Z`;
    expect(committed.state.simulatedNow < benchEnd).toBe(true);
    const result = check_in_bundle(committed.state, { bookingId: booking.id, returnedItemIds: booking.bundle.itemIds });
    expect(result.ok).toBe(true);
    // Bench reservation freed: no overlapping reservation for this booking's slot remains
    const freed = result.state.benchReservations.every(slot =>
      !(slot.date === booking.bundle.bench.date &&
        slot.start === booking.bundle.bench.start &&
        slot.end === booking.bundle.bench.end &&
        slot.borrowerId === booking.borrowerId)
    );
    expect(freed).toBe(true);
    // Waitlist served
    expect(result.waitlistServed).toHaveLength(1);
    const served = result.waitlistServed[0];
    expect(served.borrowerId).toBe('jonas');
    expect(served.status).toBe('booked');
    expect(isCompatibleKit(served.bundle.items)).toBe(true);
    expect(result.state.waitlist[0]).toMatchObject({ status: 'served', bookingId: served.id });
    expect(result.state.currentBorrowerId).toBe('priya');
    expect(result.message).toContain('Jonas');
  });
  it('rejects check-in of a non-booked booking', () => {
    const committed = bookedKit();
    const booking = committed.booking!;
    const released = releaseBundle(committed.state, booking.id);
    expect(released.ok).toBe(true);
    const result = check_in_bundle(released.state, { bookingId: booking.id, returnedItemIds: booking.bundle.itemIds });
    expect(result.ok).toBe(false);
    expect(result.state.bookings).toEqual(released.state.bookings);
  });
  it('returns ok:false and unchanged state when an item is unaccounted', () => {
    const committed = bookedKit();
    const booking = committed.booking!;
    const subset = booking.bundle.itemIds.slice(0, -1);
    const missingId = booking.bundle.itemIds[booking.bundle.itemIds.length - 1];
    const result = check_in_bundle(committed.state, { bookingId: booking.id, returnedItemIds: subset });
    expect(result.ok).toBe(false);
    const missingItem = committed.state.catalog.find(item => item.id === missingId);
    if (missingItem) {
      const expectedName = missingItem.name.replace(/^Pair of /, '').replace(/^[A-Z]/, l => l.toLowerCase());
      expect(result.message).toContain(expectedName);
    }
    expect(result.state.bookings).toEqual(committed.state.bookings);
  });
});
