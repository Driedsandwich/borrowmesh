import { describe, expect, it } from 'vitest';
import { routeIntent } from '../src/client/intent-router.js';

describe('deterministic conversation router', () => {
  it.each([
    'What do I need to build a planter box on Saturday afternoon?',
    'What tools do I need for my planter box?',
    'Show planter box requirements',
  ])('recognizes requirements: %s', (text) => expect(routeIntent(text)).toEqual({ type: 'requirements', project: 'planter-box' }));
  it.each(['Find me a kit', 'Compare available kits, please.', 'Search for a bundle'])('finds complete kits: %s', (text) => expect(routeIntent(text)).toEqual({ type: 'find', project: 'planter-box' }));
  it.each([
    ['Choose the first kit', 0], ['Hold bundle 2', 1], ['Pick the third one', 2], ['Choose the corded option', 0],
  ])('chooses a visible option: %s', (text, index) => expect(routeIntent(String(text))).toEqual({ type: 'choose', index }));
  it.each(['Book it', 'Commit this hold', 'Confirm my kit', 'Reserve this bundle'])('commits only on request: %s', (text) => expect(routeIntent(text)).toEqual({ type: 'commit' }));
  it.each(['What did I book?', 'Show my booking', 'My reservation'])('restores the booking: %s', (text) => expect(routeIntent(text)).toEqual({ type: 'booking' }));
  it.each(['The clamps are broken', 'My clamp broke', 'These clamps are damaged'])('reports the affected item: %s', (text) => expect(routeIntent(text)).toEqual({ type: 'issue', target: 'clamps', kind: 'broken' }));
  it('distinguishes late reports', () => expect(routeIntent('The drill is overdue')).toEqual({ type: 'issue', target: 'drill', kind: 'late' }));
  it.each(['Cancel my booking', 'Release the entire kit', 'Cancel my reservation'])('releases the bundle: %s', (text) => expect(routeIntent(text)).toEqual({ type: 'release' }));
  it('does not turn an unknown question into an action', () => expect(routeIntent('Tell me about the weather')).toEqual({ type: 'unknown' }));
  it('does not guess an item for an issue report', () => expect(routeIntent('Something is broken')).toEqual({ type: 'unknown' }));
  it('recognizes the reset explicitly', () => expect(routeIntent('Reset the demo')).toEqual({ type: 'reset' }));
  it('uses the shelf-repair template identifier', () => expect(routeIntent('What do I need to repair a shelf?')).toEqual({ type: 'requirements', project: 'shelf-repair' }));
  it('recognizes explicit shelf kit searches', () => expect(routeIntent('Find a kit for shelf repair')).toEqual({ type: 'find', project: 'shelf-repair' }));
  it('keeps the discussed project for a follow-up', () => expect(routeIntent('Find me a kit', 'shelf-repair')).toEqual({ type: 'find', project: 'shelf-repair' }));
  it('lets an explicit project replace the discussed project', () => expect(routeIntent('Find a planter box kit', 'shelf-repair')).toEqual({ type: 'find', project: 'planter-box' }));
});
