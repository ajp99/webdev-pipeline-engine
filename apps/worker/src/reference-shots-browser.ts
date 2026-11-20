// Playwright's chromium for the reference-site tool (P3-T12). The owner installs the browser once:
// pnpm --filter @wpe/worker exec playwright install chromium
import { chromium } from 'playwright';
import { MAX_HEIGHT, VIEWPORT, type ShotBrowser } from './reference-shots';

export async function playwrightBrowser(): Promise<ShotBrowser> {
  const browser = await chromium.launch();
  return {
    async shoot(url, allow, timeoutMs) {
      const ctx = await browser.newContext({
        viewport: VIEWPORT,
        serviceWorkers: 'block',
        acceptDownloads: false,
      });
      try {
        // Every request is checked; anything to a non-public address is blocked, and so are web sockets.
        await ctx.route('**/*', async (route) =>
          (await allow(route.request().url())) ? route.continue() : route.abort('blockedbyclient'),
        );
        await ctx.routeWebSocket(/.*/, (ws) => ws.close());
        const page = await ctx.newPage();
        await page.goto(url, { timeout: timeoutMs, waitUntil: 'load' });
        const height = Math.min(
          await page.evaluate('document.documentElement.scrollHeight'),
          MAX_HEIGHT,
        );
        return await page.screenshot({
          type: 'jpeg',
          quality: 70,
          fullPage: true,
          clip: { x: 0, y: 0, width: VIEWPORT.width, height: Math.max(height, VIEWPORT.height) },
          timeout: timeoutMs,
        });
      } finally {
        await ctx.close();
      }
    },
    close: () => browser.close(),
  };
}
