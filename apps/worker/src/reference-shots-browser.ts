// Playwright's chromium for the reference-site tool (P3-T12). Known gap until go-live (G34): Chromium and
// route.fetch resolve a name again after checkUrl did, so a DNS answer that changes in between (rebinding) is
// not caught; the fix is a checking proxy that resolves once and connects to that address. The owner installs the browser once:
// pnpm --filter @wpe/worker exec playwright install chromium
import { chromium } from 'playwright';
import { MAX_HEIGHT, responseAllowed, VIEWPORT, type ShotBrowser } from './reference-shots';

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
        await ctx.route('**/*', async (route) => {
          const url = route.request().url();
          if (!(await allow(url))) return route.abort('blockedbyclient');
          // Fetch one hop only and check a redirect's target before the browser may follow it.
          const res = await route.fetch({ maxRedirects: 0, timeout: timeoutMs });
          if (!(await responseAllowed(url, res.status(), res.headers()['location'], allow)))
            return route.abort('blockedbyclient');
          return route.fulfill({ response: res });
        });
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
