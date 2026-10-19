import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync(new URL('../src/client/style.css', import.meta.url), 'utf8');
const palette = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6})\b/gi)].map(match => [match[1], match[2]]));

function luminance(hex: string): number {
  const [r, g, b] = hex.slice(1).match(/../g)!.map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

it('keeps workshop text and status colors at WCAG AA contrast for normal text', () => {
  const pairs = [
    ...['concrete', 'surface', 'panel', 'substitute-bg', 'out-bg'].flatMap(background =>
      ['ink', 'muted', 'accent'].map(foreground => [palette[foreground], palette[background]])),
    ...['booked', 'held', 'substitute', 'out'].map(status => [palette[`${status}-ink`], palette[`${status}-bg`]]),
    ...['accent', 'booked-ink', 'held-ink'].map(background => ['#ffffff', palette[background]]),
    [palette['booked-ink'], palette.concrete],
    [palette['substitute-ink'], palette.surface],
    [palette.signal, palette.ink],
    ['#ffab80', palette.ink],
    ['#a5caed', palette.ink],
    ['#dce2e7', '#303943'],
    [palette.concrete, palette.ink],
  ];
  for (const [foreground, background] of pairs) {
    expect(foreground).toMatch(/^#[\da-f]{6}$/i);
    expect(background).toMatch(/^#[\da-f]{6}$/i);
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    expect((values[0] + 0.05) / (values[1] + 0.05), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
  }
});
