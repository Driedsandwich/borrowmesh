import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { Locator } from '@playwright/test';
import { root, readTimeline, validateStoryboard } from './video-common.js';

process.chdir(root);
if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: npm run video:record -- [--check]');
const narration = validateStoryboard();
// A fresh checkout can validate preparation without synthesized media, a browser,
// a server, or macOS speech synthesis. This is not a recording verification.
if (process.argv.includes('--check')) {
  console.log('Recorder preparation check passed: canonical storyboard; ports 3002/5174; 1280x800. No browser launched.');
} else {
  const timeline = readTimeline();
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(root, 'data/browser-cache');
  process.env.TMPDIR = resolve(root, 'data/browser-tmp');
  await mkdir(process.env.TMPDIR, { recursive: true });
  const [{ chromium, expect }, { createServer }, { createApplication }] = await Promise.all([
    import('@playwright/test'), import('vite'), import('../src/server/app.js'),
  ]);
  await mkdir('video/raw', { recursive: true });
  const dataFile = `video/raw/library-${randomUUID()}.json`;
  const application = await createApplication({ dataFile });
  let web: Awaited<ReturnType<typeof createServer>> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    // Dedicated state, strict ports: never reset another person's running app.
    await application.listen(3002);
    web = await createServer({ server: { host: '127.0.0.1', port: 5174, strictPort: true } });
    await web.listen();
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: 'video/raw', size: { width: 1280, height: 800 } }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const video = page.video()!;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const ui = (id: string) => page.getByTestId(id);
    const ready = async () => {
      await expect(ui('utterance-input')).toBeEnabled();
      await expect(ui('send-button')).toBeEnabled();
    };
    const show = async (locator: Locator) => { await locator.scrollIntoViewIfNeeded(); };
    const click = async (locator: Locator) => { await show(locator); await locator.hover(); await page.waitForTimeout(140); await locator.click(); };
    const utter = async (text: string) => { await ready(); await ui('utterance-input').fill(text); await click(ui('send-button')); await ready(); };
    await page.goto('http://127.0.0.1:5174');
    await ready();
    await click(ui('reset-button'));
    await ready();
    // Browser speech stays off; separate local narration is mixed in afterwards.
    await page.getByLabel('Spoken replies').uncheck();

    const markerColors = narration.map((_, i) => [40 + (i % 3) * 90, 40 + (Math.floor(i / 3) % 3) * 90, i < 9 ? 70 : 210]);
    const marker = async (color: number[]) => {
      await page.evaluate(rgb => {
        let element = document.querySelector<HTMLDivElement>('#recording-sync-marker');
        if (!element) {
          element = document.createElement('div'); element.id = 'recording-sync-marker'; element.setAttribute('aria-hidden', 'true');
          element.style.cssText = 'position:fixed;left:0;top:0;width:32px;height:32px;z-index:2147483647;pointer-events:none';
        }
        (document.querySelector('dialog[open]') ?? document.body).append(element);
        element.style.background = `rgb(${rgb.join(',')})`;
      }, color);
    };
    type Tile = { id: string; text: string; status: string | null };
    const tiles = async (): Promise<Tile[]> => ui('kit-board').locator('[data-item-id]').evaluateAll(nodes => nodes.map(node => ({ id: node.getAttribute('data-item-id')!, text: node.textContent ?? '', status: node.getAttribute('data-status') })));
    let bookedTiles: Tile[] = [];
    let savedState = '';
    for (const [index, segment] of narration.entries()) {
      console.log(`Recording ${segment.id}: ${segment.action}`);
      switch (segment.id) {
        case 'hook': await show(ui('kit-board')); break;
        case 'requirements':
          await utter('What do I need to build a planter box on Saturday afternoon?');
          await expect(page.locator('body')).toContainText(/3\s?mm/);
          await expect(page.locator('body')).toContainText(/6\s?mm/);
          break;
        case 'compare':
          await utter('Find me a kit');
          await expect(ui('bundle-card-0')).toBeVisible();
          await expect(ui('bundle-card-1')).toBeVisible();
          await expect(ui('bundle-card-0')).toContainText(/corded/i);
          break;
        case 'hold':
          await click(ui('choose-bundle-0')); await ready();
          await expect(ui('booking-status')).toContainText('Held');
          await expect(ui('kit-board').locator('[data-status="held"]').first()).toBeVisible();
          break;
        case 'consent':
          await click(ui('commit-button'));
          await expect(ui('consent-dialog')).toBeVisible();
          await expect(ui('consent-dialog')).toContainText(/corded/i);
          break;
        case 'booked':
          await expect(ui('booking-status')).toContainText('Booked');
          bookedTiles = await tiles();
          if (!bookedTiles.length) throw new Error('Booked kit has no item tiles.');
          savedState = JSON.stringify(application.store.snapshot().bookings);
          await show(ui('bench-timeline')); break;
        case 'persistence':
          await page.reload(); await ready(); await utter('What did I book?');
          await expect(ui('booking-status')).toContainText('Booked');
          if (JSON.stringify(application.store.snapshot().bookings) !== savedState) throw new Error('Client reload changed persisted booking state.');
          expect((await tiles()).map(tile => tile.id).sort()).toEqual(bookedTiles.map(tile => tile.id).sort());
          break;
        case 'repair': {
          await utter('The clamps are broken');
          const repaired = await tiles();
          const oldClamps = bookedTiles.filter(tile => /clamp/i.test(tile.text));
          if (oldClamps.length !== 1) throw new Error('Expected one two-clamp catalog item before repair.');
          for (const kept of bookedTiles.filter(tile => !/clamp/i.test(tile.text))) expect(repaired.find(tile => tile.id === kept.id)).toBeDefined();
          expect(repaired.some(tile => tile.id === oldClamps[0].id)).toBe(false);
          await expect(ui('booking-status')).toContainText('Booked');
          await show(ui('kit-board')); break;
        }
        case 'release':
          await utter('Cancel my booking');
          await expect(ui('booking-status')).toContainText('Released');
          await expect(page.locator('body')).toContainText('Jonas');
          break;
        case 'protocol':
          await click(ui('protocol-toggle'));
          await expect(ui('protocol-log')).toContainText('2025-11-25');
          for (const method of ['initialize', 'tools/list', 'tools/call', 'elicitation/create']) await expect(ui('protocol-log')).toContainText(method);
          await show(ui('protocol-inspector')); break;
        case 'close':
          await click(ui('protocol-toggle'));
          await expect(page.locator('footer')).toContainText('All library data is fictional.');
          await show(page.locator('footer')); break;
      }
      await marker(markerColors[index]);
      const holdMs = timeline.segments[index].durationMs;
      if (segment.id === 'protocol') {
        const entries = ui('protocol-log').locator('.protocol-entry');
        const examples = [
          entries.filter({ hasText: '"result"' }).filter({ hasText: '"protocolVersion": "2025-11-25"' }).first(),
          entries.filter({ hasText: '"method": "tools/list"' }).first(),
          entries.filter({ hasText: '"method": "tools/call"' }).first(),
          entries.filter({ hasText: '"method": "elicitation/create"' }).first(),
        ];
        for (const entry of examples) {
          await expect(entry).toHaveCount(1);
          await show(entry);
          // Align the beginning of each raw exchange inside its scroll panel.
          await entry.evaluate(element => {
            const panel = document.querySelector<HTMLElement>('[data-testid="protocol-log"]')!;
            panel.scrollTop += element.getBoundingClientRect().top - panel.getBoundingClientRect().top - 8;
          });
          await page.waitForTimeout(holdMs / examples.length);
        }
      } else await page.waitForTimeout(holdMs);
      await marker([0, 0, 0]);
      if (segment.id === 'consent') { await click(ui('consent-accept')); await ready(); }
    }
    expect(errors).toEqual([]);
    await page.waitForTimeout(250);
    await context.close();
    const videoFile = (await video.path()).replace(`${root}/`, '');
    const durationMs = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', videoFile], { encoding: 'utf8' }).trim()) * 1000;
    const frameInfo = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'json', videoFile], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })) as { frames: Array<{ best_effort_timestamp_time: string }> };
    const pixels = execFileSync('ffmpeg', ['-v', 'error', '-i', videoFile, '-vf', 'crop=8:8:12:12,scale=1:1', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: 16 * 1024 * 1024 });
    if (pixels.length !== frameInfo.frames.length * 3) throw new Error('Decoded frame count does not match timestamp count.');
    const frames = frameInfo.frames.map((frame, i) => {
      const pixel = [...pixels.subarray(i * 3, i * 3 + 3)];
      const distances = markerColors.map(color => color.reduce((sum, value, channel) => sum + (value - pixel[channel]) ** 2, 0));
      const distance = Math.min(...distances);
      return { ms: Math.round(Number(frame.best_effort_timestamp_time) * 1000), segment: distance <= 1225 ? distances.indexOf(distance) : -1 };
    });
    const segments = narration.map((segment, index) => {
      const first = frames.findIndex(frame => frame.segment === index);
      let last = frames.length - 1;
      while (last >= 0 && frames[last].segment !== index) last--;
      if (first < 0 || last < first) throw new Error(`Encoded timing marker missing: ${segment.id}.`);
      return { id: segment.id, startMs: frames[first].ms, endMs: frames[last + 1]?.ms ?? durationMs };
    });
    const timingResolutionMs = Math.max(...frames.slice(1).map((frame, i) => frame.ms - frames[i].ms));
    await writeFile('video/raw/segments.json', JSON.stringify({ videoFile, segments, durationMs, width: 1280, height: 800, timingMethod: 'encoded corner marker transitions with ffprobe frame timestamps', timingResolutionMs, dataFile }, null, 2) + '\n');
    console.log(`Recorded ${videoFile}, ${(durationMs / 1000).toFixed(2)} s. Browser reload verified; process-restart persistence is covered separately by integration tests.`);
    if (durationMs + 5000 >= 180000) throw new Error('Recording plus cards reaches three minutes. Shorten narration and re-record.');
  } finally {
    await browser?.close(); await web?.close(); await application.close();
  }
}
