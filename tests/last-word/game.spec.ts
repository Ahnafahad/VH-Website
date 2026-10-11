import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end Last Word. The DOM never exposes answers before judgment, so the test reads them from
 * the content files (beat text → best word / worst word).
 */
type Beat = { text: string; best_word: string; fit: Record<string, number> };
const dir = join(process.cwd(), 'content', 'last-word', 'sets');
const beats = new Map<string, Beat>();
for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const set = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { chains: { beats: Beat[] }[] };
  for (const beat of set.chains.flatMap(c => c.beats)) beats.set(beat.text.trim(), beat);
}
const best = (b: Beat) => b.best_word;
const worst = (b: Beat) => Object.entries(b.fit).sort((x, y) => x[1] - y[1])[0][0];

async function fresh(page: Page, settings: Record<string, unknown> = {}) {
  await page.goto('/last-word');
  await page.evaluate(s => {
    localStorage.clear();
    localStorage.setItem('last-word-settings-v2', JSON.stringify({ state: { tier: 'lite', reducedMotion: false, sound: false, haptics: false, music: false, tutorialDone: false, ...s }, version: 0 }));
  }, settings);
  await page.reload();
  await expect(page.getByRole('button', { name: /Enter the chamber|Continue/ })).toBeEnabled({ timeout: 60_000 });
}

/** Plays with the keyboard: number key to choose, Enter to lock, Enter/click to continue. Returns visited headings. */
async function play(page: Page, choose = best, { until = (_heading: string): boolean => false, max = 120, confidence = '' } = {}) {
  const seen: string[] = [];
  for (let i = 0; i < max; i++) {
    if (await page.getByText('TODAY YOU SHARPENED').isVisible()) break;
    const sentence = page.locator('.lw-sentence');
    const words = page.locator('.lw-word:not([disabled])');
    if (await words.count()) {
      const beat = beats.get((await sentence.innerText()).trim());
      expect(beat, 'beat text should come from content').toBeTruthy();
      const labels = await page.locator('.lw-word strong').allInnerTexts();
      const word = choose(beat!);
      const index = labels.indexOf(word) + 1;
      await page.keyboard.press(String(index));
      if (confidence && (await page.getByLabel(confidence).isVisible())) await page.getByLabel(confidence).check();
      await expect(page.locator(`.lw-word[data-word="${word}"]`)).toHaveAttribute('aria-pressed', 'true');
      await page.locator('.lw-play').press('Enter');
      continue;
    }
    const headings = page.locator('h1:visible, h2:visible:not(.lw-sr-only)');
    const heading = (await headings.count()) ? (await headings.first().innerText()).trim() : '';
    seen.push(heading);
    if (until(heading)) break;
    await page.locator('.lw-primary:visible').last().click();
  }
  return seen;
}

test.describe('Last Word', () => {
  test('tutorial: choose, flip, hold, then the Last Word line (§21) — keyboard only', async ({ page }) => {
    await fresh(page);
    await page.getByRole('button', { name: 'Enter the chamber' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('LEARN THE FEEL')).toBeVisible();
    // Beat 1 → confident; beat 2 flips → arrogant; the field reopens and selection is reversible.
    const first = beats.get((await page.locator('.lw-sentence').innerText()).trim())!;
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    const labels = await page.locator('.lw-word strong').allInnerTexts();
    await page.keyboard.press(String(labels.indexOf(first.best_word) + 1));
    await expect(page.getByText(/you can still change it/)).toBeVisible();
    const seen = await play(page, best, { until: h => h.startsWith('Prove what you know') });
    expect(seen).toContain('One detail can change the word.');
    expect(seen).toContain('New information doesn’t always mean a new answer.');
    expect(seen).toContain('Read the situation. Follow the meaning. Have the Last Word.');
  });

  test('a learner who knows a distinction proves it and skips teaching (§14 A)', async ({ page }) => {
    await fresh(page, { tutorialDone: true });
    await page.getByRole('button', { name: 'Continue' }).click();
    const seen = await play(page, best, { until: h => h.startsWith('You already own') });
    expect(seen.at(-1)).toBe('You already own this distinction.');
  });

  test('wrong answers get the decisive clue and a contrast, never a buzzer screen (§16, §40)', async ({ page }) => {
    await fresh(page, { tutorialDone: true });
    await page.getByRole('button', { name: 'Continue' }).click();
    await play(page, worst, { until: h => h.startsWith('Where one word stops') });
    await expect(page.getByRole('heading', { name: 'Where one word stops and the other starts' })).toBeVisible();
    await page.locator('.lw-primary:visible').click();
    await play(page, worst, { until: h => /fits/i.test(h) });
    await expect(page.locator('.lw-feedback')).toContainText(/fits/i);
    await expect(page.locator('.lw-feedback mark, .lw-feedback .lw-clue-quote').first()).toBeVisible();
  });

  test('a session saves on this browser and the mastery map reflects it after reload', async ({ page }) => {
    await fresh(page, { tutorialDone: true });
    await page.getByRole('button', { name: 'Continue' }).click();
    await play(page, best);
    await expect(page.getByText('TODAY YOU SHARPENED')).toBeVisible();
    await expect(page.getByText('Saved on this browser.')).toBeVisible();
    await expect(page.getByText(/skipped because you already knew/)).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Mastery Map' }).click();
    await expect(page.getByRole('heading', { name: 'Mastery Map' })).toBeVisible();
    await expect(page.locator('.lw-mastery-row .lw-status').filter({ hasNotText: 'NEW' }).first()).toBeVisible();
    // Words and distinctions are shown separately (§51).
    await expect(page.getByRole('group', { name: 'Words' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Distinctions' })).toBeVisible();
  });

  test('touch: swipe across the word field switches the selection', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await fresh(page, { tutorialDone: true });
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('.lw-primary:visible').click();
    const field = page.locator('.lw-word-field');
    const box = (await field.boundingBox())!;
    const swipe = async (dx: number) => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
    };
    await swipe(140);
    const right = await page.locator('.lw-word[aria-pressed="true"]').getAttribute('data-word');
    expect(right).toBeTruthy();
    await swipe(-140);
    const left = await page.locator('.lw-word[aria-pressed="true"]').getAttribute('data-word');
    expect(left).not.toBe(right);
    // Tap targets stay at least 44 px and nothing overflows the phone width.
    for (const b of await page.locator('.lw-word, .lw-primary:visible').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await context.close();
  });

  test('WebGL unavailable falls back to the Lite chamber with the same game', async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return /webgl/.test(type) ? null : (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof original;
    });
    const page = await context.newPage();
    await fresh(page, { tier: 'auto', tutorialDone: true });
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('.lw-game')).toHaveAttribute('data-tier', 'lite');
    await expect(page.locator('canvas')).toHaveCount(0);
    const seen = await play(page, best, { until: h => h.startsWith('You already own') });
    expect(seen.at(-1)).toBe('You already own this distinction.');
    await context.close();
  });

  for (const variant of [{ tier: 'full', reduced: false }, { tier: 'standard', reduced: false }, { tier: 'lite', reduced: false }, { tier: 'full', reduced: true }]) {
    test(`identical learning outcome — ${variant.tier}${variant.reduced ? ' + reduced motion' : ''}`, async ({ page }) => {
      test.setTimeout(300_000); // software WebGL (swiftshader) renders slowly; a whole session takes minutes
      if (variant.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
      await fresh(page, { tier: variant.tier, tutorialDone: true });
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.locator('.lw-game')).toHaveAttribute('data-reduced', String(variant.reduced));
      await page.getByRole('button', { name: 'Prove what you know' }).click();
      if (variant.tier !== 'lite') await expect(page.locator('canvas[data-chamber="ready"]')).toBeVisible({ timeout: 30_000 });
      // A fixed, mixed strategy: right on even beats, wrong on odd ones.
      let n = 0;
      const seen = await play(page, b => (n++ % 2 ? worst(b) : best(b)));
      const rows = await page.locator('.lw-mastery-row').allInnerTexts();
      expect(JSON.stringify({ seen: seen.filter(h => !/^Beat /.test(h)), rows }, null, 1)).toMatchSnapshot('outcome.json');
    });
  }
});
