import { readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const storyboardIds = ['hook', 'requirements', 'compare', 'hold', 'consent', 'booked', 'persistence', 'repair', 'release', 'protocol', 'close'];
export type Narration = { id: string; action: string; narrator: string; assistant: string };
export type Clip = { file: string; durationMs: number };
export type AudioSegment = { id: string; narrator: Clip | null; assistant: Clip | null; durationMs: number };
export type AudioTimeline = { segments: AudioSegment[]; durationMs: number };

export function localFile(path: string): string {
  if (typeof path !== 'string' || isAbsolute(path)) throw new Error('Media paths must be project-relative.');
  const full = realpathSync(resolve(root, path));
  const rel = relative(root, full);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Path escapes project: ${path}`);
  return full;
}

export function readNarration(): Narration[] {
  const rows: unknown = JSON.parse(readFileSync(localFile('video/narration.json'), 'utf8'));
  if (!Array.isArray(rows) || rows.length !== storyboardIds.length) throw new Error('Narration must contain the complete canonical storyboard.');
  rows.forEach((row: Narration, index: number) => {
    if (!row || row.id !== storyboardIds[index] || !row.action?.trim() || typeof row.narrator !== 'string' || typeof row.assistant !== 'string' || !(row.narrator + row.assistant).trim()) {
      throw new Error(`Invalid narration segment at index ${index}.`);
    }
  });
  return rows as Narration[];
}

export function validateStoryboard(): Narration[] {
  const rows = readNarration();
  const wordCount = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;
  const narratorWords = rows.reduce((sum, row) => sum + wordCount(row.narrator), 0);
  const assistantWords = rows.reduce((sum, row) => sum + wordCount(row.assistant), 0);
  const requiredReplies = ['requirements', 'compare', 'hold', 'consent', 'booked', 'repair', 'release'];
  for (const row of rows) {
    if (requiredReplies.includes(row.id) && !row.assistant.trim()) throw new Error(`Missing assistant reply: ${row.id}.`);
    if (wordCount(row.assistant) > 25) throw new Error(`Assistant reply exceeds 25 words: ${row.id}.`);
  }
  const words = narratorWords + assistantWords;
  // Planning estimate only: 165 words/minute, 0.8 s tails, 15 s interaction, 5 s cards.
  const estimateSeconds = words / 165 * 60 + rows.length * 0.8 + 15 + 5;
  if (estimateSeconds < 140 || estimateSeconds > 165) throw new Error(`Estimated video length ${estimateSeconds.toFixed(1)} s is outside the 140–165 s target.`);
  console.log(`Storyboard valid: ${rows.length} segments, ${words} English words (narrator ${narratorWords} / assistant ${assistantWords}), estimated ${estimateSeconds.toFixed(1)} s; actual media duration remains unverified.`);
  return rows;
}

export function readTimeline(): AudioTimeline {
  const timeline = JSON.parse(readFileSync(localFile('video/audio/timeline.json'), 'utf8')) as AudioTimeline;
  if (!Array.isArray(timeline.segments) || JSON.stringify(timeline.segments.map(s => s.id)) !== JSON.stringify(storyboardIds)) throw new Error('Audio timeline does not match narration. Run video:synth again.');
  for (const row of timeline.segments) {
    let clipsMs = 0;
    for (const clip of [row.narrator, row.assistant]) {
      if (!clip) continue;
      localFile(clip.file);
      if (!Number.isFinite(clip.durationMs) || clip.durationMs <= 0) throw new Error(`Invalid audio clip: ${row.id}.`);
      clipsMs += clip.durationMs;
    }
    if (!Number.isFinite(row.durationMs) || row.durationMs < clipsMs || row.durationMs <= 0) throw new Error(`Invalid audio hold: ${row.id}.`);
  }
  const total = timeline.segments.reduce((sum, row) => sum + row.durationMs, 0);
  if (total !== timeline.durationMs || total + 5000 >= 180000) throw new Error('Invalid timeline total or audio reaches the three-minute limit.');
  return timeline;
}
