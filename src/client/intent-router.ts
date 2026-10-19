export type ProjectIntent = 'planter-box' | 'shelf-repair';
export type Intent =
  | { type: 'requirements'; project: ProjectIntent }
  | { type: 'find'; project: ProjectIntent }
  | { type: 'choose'; index: number }
  | { type: 'commit' }
  | { type: 'booking' }
  | { type: 'issue'; target: 'clamps' | 'drill' | 'saw' | 'glasses'; kind: 'broken' | 'late' }
  | { type: 'release' }
  | { type: 'reset' }
  | { type: 'unknown' };

/** A deliberately small, local router. It never sends the conversation to an AI service. */
export function routeIntent(input: string, currentProject: ProjectIntent = 'planter-box'): Intent {
  const text = input.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return { type: 'unknown' };
  if (/\b(reset|restart)\b.*\b(demo|scenario)\b/.test(text)) return { type: 'reset' };
  if (/\b(cancel|release)\b.*\b(booking|reservation|kit|bundle|everything)\b/.test(text)) return { type: 'release' };
  if (/\b(broken|broke|damaged|late|overdue)\b/.test(text)) {
    const target = /\bclamps?\b/.test(text) ? 'clamps' : /\bdrill\b/.test(text) ? 'drill' : /\bsaw\b/.test(text) ? 'saw' : /\b(glasses|goggles)\b/.test(text) ? 'glasses' : undefined;
    if (target) return { type: 'issue', target, kind: /\b(late|overdue)\b/.test(text) ? 'late' : 'broken' };
  }
  if (/\b(what|show|view|check)\b.*\b(book|booked|booking|reservation)\b/.test(text) || /^(my booking|my reservation)$/.test(text)) return { type: 'booking' };
  if (/\b(choose|select|hold|take|pick)\b/.test(text)) {
    const match = text.match(/\b(first|second|third|one|two|three|1|2|3)\b/);
    if (match) return { type: 'choose', index: ['first', 'one', '1'].includes(match[1]!) ? 0 : ['second', 'two', '2'].includes(match[1]!) ? 1 : 2 };
    if (/\b(corded|outlet)\b/.test(text)) return { type: 'choose', index: 0 };
  }
  if (/\b(book|commit|confirm|reserve)\b/.test(text) && !/\b(what|show)\b/.test(text)) return { type: 'commit' };
  const project = /\bshelf\b/.test(text) ? 'shelf-repair' : /\bplanter\b/.test(text) ? 'planter-box' : currentProject;
  if (/\b(find|search|compare)\b.*\b(kit|kits|bundle|bundles|tools)\b/.test(text) || /^(find me a kit|show kits|show me the kits)$/.test(text)) return { type: 'find', project };
  if (/\b(need|requirements|build|make)\b/.test(text) && /\b(planter|shelf|requirements|need)\b/.test(text)) return { type: 'requirements', project };
  return { type: 'unknown' };
}
