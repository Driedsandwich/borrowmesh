// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commitBundle, createInitialState, findCompatibleKits, holdResources, releaseBundle, reportIssue } from '../src/domain/library.js';
import type { LibraryState } from '../src/shared/types.js';
import type { ElicitRequest, ElicitResult } from '@modelcontextprotocol/sdk/types.js';
import type { ProtocolEntry } from '../src/client/mcp.js';
import narration from '../video/narration.json';

const harness = vi.hoisted(() => ({
  call: vi.fn(),
  consent: undefined as undefined | ((request: ElicitRequest, signal?: AbortSignal) => Promise<ElicitResult>),
  traffic: undefined as undefined | ((entry: ProtocolEntry) => void),
}));

vi.mock('../src/client/mcp.js', () => ({
  BorrowMeshClient: class {
    constructor(onTraffic: (entry: ProtocolEntry) => void, onConsent: (request: ElicitRequest, signal?: AbortSignal) => Promise<ElicitResult>) {
      harness.consent = onConsent; harness.traffic = onTraffic;
    }
    async connect() {
      harness.traffic?.({ direction: 'received', time: '12:00:00', message: { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-11-25' } } });
      return { protocolVersion: '2025-11-25', sessionId: 'test-session', toolNames: ['get_library_state', 'find_compatible_kit'] };
    }
    call(name: string, args: Record<string, unknown>) { return harness.call(name, args); }
  },
}));

let state: LibraryState;
const node = <T extends HTMLElement = HTMLElement>(id: string) => document.querySelector<T>(`[data-testid="${id}"]`)!;
async function settle(): Promise<void> { await vi.waitFor(() => expect(node<HTMLButtonElement>('send-button').disabled).toBe(false)); }
async function click(id: string): Promise<void> { node<HTMLButtonElement>(id).click(); await settle(); }
function expectSpokenReply(id: string, text = document.querySelector('.message-assistant:last-child > p')?.textContent): void {
  // Only number/time pronunciation differs between the screen and the video voice.
  const spoken = text?.replace('14:00–16:30.', 'two to four-thirty p.m.').replace('17:00.', 'five p.m.').replace(/\b10\b/g, 'ten').replace(/\b3\b/g, 'three');
  const assistant = narration.find(segment => segment.id === id)?.assistant;
  expect(assistant).toBeTruthy();
  expect(spoken).toBe(assistant);
}
async function send(text: string): Promise<void> {
  node<HTMLInputElement>('utterance-input').value = text;
  node<HTMLButtonElement>('send-button').click();
  await settle();
}
async function mount(): Promise<void> {
  document.body.innerHTML = '<div id="app"></div>';
  await import('../src/client/main.js');
  await settle();
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  sessionStorage.clear();
  state = createInitialState();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
  harness.call.mockReset();
  harness.call.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    let result: Record<string, unknown>;
    switch (name) {
      case 'get_library_state': result = { state, message: 'Library state.' }; break;
      case 'find_compatible_kit': result = findCompatibleKits(state, args as unknown as Parameters<typeof findCompatibleKits>[1]) as unknown as Record<string, unknown>; break;
      case 'hold_resources': result = holdResources(state, String(args.bundleId)) as unknown as Record<string, unknown>; break;
      case 'commit_bundle': {
        const preview = commitBundle(state, String(args.holdId));
        const answer = preview.needsConsent ? await harness.consent!({ method: 'elicitation/create', params: { mode: 'form', message: preview.consentReason || preview.message, requestedSchema: { type: 'object', properties: { consent: { type: 'boolean' } }, required: ['consent'] } } }) : undefined;
        result = commitBundle(state, String(args.holdId), answer ? answer.action === 'accept' && answer.content?.consent === true : undefined) as unknown as Record<string, unknown>;
        break;
      }
      case 'get_booking': result = { state, booking: state.bookings.find((candidate) => candidate.borrowerId === 'priya' && candidate.status === 'booked'), message: 'Saved booking checked.' }; break;
      case 'report_issue': result = reportIssue(state, String(args.bookingId), String(args.itemId), args.kind as 'broken' | 'late') as unknown as Record<string, unknown>; break;
      case 'release_bundle': result = releaseBundle(state, String(args.bookingId)) as unknown as Record<string, unknown>; break;
      case 'reset_demo': state = createInitialState(); result = { state, message: 'Demo reset.' }; break;
      default: throw new Error(`Unexpected tool ${name}`);
    }
    if (result.state) state = result.state as LibraryState;
    return { ...result, kind: name };
  });
  await mount();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('workbench UI with deterministic domain responses (no browser)', () => {
  it('completes requirements, compare, hold, consent, reload, repair, and atomic release', async () => {
    await click('chip-requirements');
    expect(document.querySelector('.requirements-card')?.textContent).toContain('3 mm and 6 mm');
    expect(document.getElementById('conversation')?.textContent).toContain('nothing is reserved yet');
    expectSpokenReply('requirements');
    await click('chip-find');
    expect(document.querySelectorAll('.bundle-card')).toHaveLength(3);
    expectSpokenReply('compare');
    node<HTMLButtonElement>('bundle-details-0').click();
    expect(node('kit-detail-dialog').hasAttribute('open')).toBe(true);
    expect(document.querySelectorAll('.detail-items li')).toHaveLength(state.bundles[0]!.items.length);
    expect(document.querySelector('.detail-substitutions')?.textContent).toContain('corded');
    document.getElementById('close-kit-detail')!.click();
    await click('choose-bundle-0');
    expect(node('booking-status').textContent).toMatch(/^Held/);
    expect(document.querySelectorAll('[data-status="held"]')).toHaveLength(state.holds[0]!.bundle.items.length);
    expectSpokenReply('hold');
    node<HTMLButtonElement>('commit-button').click();
    await vi.waitFor(() => expect(node('consent-dialog').hasAttribute('open')).toBe(true));
    expect(node('consent-dialog').textContent).toContain('corded drill');
    expectSpokenReply('consent', document.getElementById('consent-message')?.textContent);
    node<HTMLButtonElement>('consent-accept').click();
    await settle();
    expect(node('booking-status').textContent).toMatch(/^Booked/);
    expectSpokenReply('booked');
    const booked = state.bookings.find((candidate) => candidate.borrowerId === 'priya')!;
    expect(document.getElementById('bundle-carousel')?.classList.contains('is-compact')).toBe(true);
    expect(document.getElementById('comparison-heading')?.classList.contains('is-hidden')).toBe(true);
    expect(document.querySelectorAll('.bundle-card, .empty-comparison')).toHaveLength(0);
    expect(document.querySelector('.kit-summary')?.textContent).toContain(`Booked kit · ${booked.bundle.name}`);
    expect(document.querySelector('.kit-summary')?.textContent).toContain('Return Oct 24, 17:00');
    const originalItems = [...booked.bundle.itemIds];
    vi.clearAllTimers();
    vi.resetModules();
    await mount();
    expect(node('booking-status').textContent).toMatch(/^Booked/);
    expect(document.querySelector('.kit-summary')?.textContent).toContain(`Booked kit · ${booked.bundle.name}`);
    expect(node('protocol-log').textContent).toContain('2025-11-25');
    await click('chip-booking');
    expect(harness.call).toHaveBeenCalledWith('get_booking', { bookingId: 'mine' });
    await click('chip-issue');
    expectSpokenReply('repair');
    expect(node('kit-board').querySelector('[data-item-id="clamps-wide"]')?.getAttribute('data-status')).toBe('booked');
    expect(node('kit-board').querySelector('[data-item-id="clamps-standard"]')).toBeNull();
    expect(document.querySelector('.kit-summary')?.textContent).toContain('wide-jaw clamps');
    expect(document.querySelector('.kit-summary')?.textContent).not.toContain('standard clamps');
    const afterRepair = state.bookings.find((candidate) => candidate.id === booked.id)!;
    expect(afterRepair.bundle.itemIds.filter((id) => id !== 'clamps-wide')).toEqual(originalItems.filter((id) => id !== 'clamps-standard'));
    await click('chip-cancel');
    expectSpokenReply('release');
    expect(node('booking-status').textContent).toMatch(/^Released/);
    expect(node('kit-board').querySelectorAll('[data-status="booked"]')).toHaveLength(0);
    expect(state.waitlist.find((entry) => entry.borrowerId === 'jonas')?.status).toBe('served');
    expect(document.getElementById('bundle-carousel')?.classList.contains('is-compact')).toBe(true);
    expect(document.getElementById('comparison-heading')?.classList.contains('is-hidden')).toBe(true);
    expect(document.querySelectorAll('.bundle-card, .empty-comparison')).toHaveLength(0);
    expect(document.querySelector('.kit-summary')?.textContent).toBe('Booking cancelled. Find a kit for another project.');
    expect(document.getElementById('conversation')?.textContent).toContain('Jonas, on the waitlist, now has a complete booking.');
    await click('chip-find');
    expect(document.getElementById('bundle-carousel')?.classList.contains('is-compact')).toBe(true);
    expect(document.querySelectorAll('.bundle-card')).toHaveLength(0);
    await click('reset-button');
    expect(document.querySelector('.kit-summary')?.textContent).toBe('Find a kit to compare complete sets.');
    await click('chip-find');
    expect(document.getElementById('bundle-carousel')?.classList.contains('is-compact')).toBe(false);
    expect(document.getElementById('comparison-heading')?.classList.contains('is-hidden')).toBe(false);
    expect(document.querySelectorAll('.bundle-card').length).toBeGreaterThan(0);
  });

  it.each(['consent-decline', 'consent-cancel'])('%s leaves the kit unbooked', async (button) => {
    await click('chip-find');
    await click('choose-bundle-0');
    node<HTMLButtonElement>('commit-button').click();
    await vi.waitFor(() => expect(node('consent-dialog').hasAttribute('open')).toBe(true));
    node<HTMLButtonElement>(button).click();
    await settle();
    expect(state.bookings.filter((candidate) => candidate.borrowerId === 'priya' && candidate.status === 'booked')).toHaveLength(0);
    expect(node('booking-status').textContent).not.toMatch(/^Booked/);
    expect(node('consent-dialog').hasAttribute('open')).toBe(false);
  });

  it('keeps a shelf follow-up tied to the shelf-repair template', async () => {
    await send('What do I need to repair a shelf?');
    expect(document.querySelector('.requirements-card')?.textContent).toContain('Shelf repair');
    await click('chip-find');
    expect(harness.call).toHaveBeenCalledWith('find_compatible_kit', expect.objectContaining({ project: 'shelf-repair' }));
    expect(document.querySelector('.bundle-items')?.textContent).not.toMatch(/saw/i);
    await send('Find a planter box kit');
    expect(harness.call).toHaveBeenCalledWith('find_compatible_kit', expect.objectContaining({ project: 'planter-box' }));
  });

  it('clears a stale booking when the server no longer has it', async () => {
    await click('chip-find');
    await click('choose-bundle-0');
    node<HTMLButtonElement>('commit-button').click();
    await vi.waitFor(() => expect(node('consent-dialog').hasAttribute('open')).toBe(true));
    node<HTMLButtonElement>('consent-accept').click();
    await settle();
    expect(node('booking-status').textContent).toMatch(/^Booked/);
    state = createInitialState();
    await click('chip-booking');
    expect(node('booking-status').textContent).toBe('Ready to plan');
    expect(node('kit-board').querySelectorAll('[data-status="booked"]')).toHaveLength(0);
  });

  it('expires a temporary hold locally and removes the commit control', async () => {
    await click('chip-find');
    await click('choose-bundle-0');
    expect(node('commit-button')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(10 * 60_000 + 1000);
    expect(node('commit-button')).toBeNull();
    expect(node('booking-status').textContent).toBe('Ready to plan');
    expect(document.getElementById('conversation')?.textContent).toContain('hold expired');
  });
});
