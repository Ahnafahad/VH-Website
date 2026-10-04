import { expect, test } from '@playwright/test';

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`stack integration with reduced motion: ${reducedMotion}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion });
    // Host analytics/auth are unrelated to this unauthenticated technical harness.
    await page.route('**/api/auth/session', (route) => route.fulfill({ json: {} }));
    await page.route('**/api/analytics/**', (route) => route.fulfill({ json: {} }));
    await page.goto('/dev/last-word-stack');
    await expect(page.getByRole('heading', { name: 'Last Word stack smoke test' })).toBeVisible();
    await expect(page.getByTestId('audio')).toHaveText('Howler: unloaded');
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('data-r3f-value', '0');
    await expect(canvas).toHaveAttribute('data-drei-centered', 'true');
    await expect(canvas).toHaveAttribute('data-rendered', 'true');
    await page.getByRole('button', { name: 'Increment shared value' }).click();
    await expect(page.getByTestId('dom-value')).toHaveText('DOM value: 1');
    await expect(canvas).toHaveAttribute('data-r3f-value', '1');
    await expect.poll(async () => Number(await canvas.getAttribute('data-mesh-scale'))).toBeCloseTo(1.25, 2);
    await page.getByRole('button', { name: 'Toggle machine' }).click();
    await expect(page.getByTestId('machine')).toHaveText('XState: on');
    await expect(page.getByTestId('machine')).toHaveAttribute('data-reduced-motion', String(reducedMotion === 'reduce'));
    await expect(page.getByTestId('machine')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 20, 0)');
    const area = await page.getByTestId('gesture').boundingBox();
    if (!area) throw new Error('Gesture surface is missing');
    await page.mouse.move(area.x + 30, area.y + 20);
    await page.mouse.down();
    await page.mouse.move(area.x + 140, area.y + 20, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByTestId('gesture')).toContainText('drag observed');
    await page.getByLabel('DOM-only presentation').check();
    await expect(canvas).toHaveCount(0);
    await page.getByRole('button', { name: 'Toggle machine' }).click();
    await expect(page.getByTestId('machine')).toHaveText('XState: off');
    await expect(page.getByText('DOM-only value: 1')).toBeVisible();
    await page.getByLabel('Disable animation').check();
    await page.getByLabel('DOM-only presentation').uncheck();
    await expect(canvas).toHaveAttribute('data-r3f-value', '1');
    await expect.poll(async () => Number(await canvas.getAttribute('data-mesh-scale'))).toBeCloseTo(1.25, 2);
    expect(errors).toEqual([]);
  });
}
