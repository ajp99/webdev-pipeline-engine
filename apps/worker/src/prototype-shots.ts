// Full-page desktop and mobile screenshots of the local preview (P3-T04), with Playwright's chromium (the owner
// installs it once: pnpm --filter @wpe/worker exec playwright install chromium). Only the local preview is opened.
import { chromium } from 'playwright';
import type { Screens } from './prototype';

const MAX_HEIGHT = 8000;

export async function previewScreenshots(url: string): Promise<Screens> {
  if (!/^http:\/\/localhost:\d{2,5}\/?$/.test(url))
    throw new Error(`not a local preview address: ${url}`);
  const browser = await chromium.launch();
  try {
    const shoot = async (viewport: { width: number; height: number }, isMobile: boolean) => {
      const ctx = await browser.newContext({
        viewport,
        isMobile,
        deviceScaleFactor: isMobile ? 2 : 1,
      });
      try {
        const page = await ctx.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
        const height = Math.min(
          Number(await page.evaluate('document.documentElement.scrollHeight')),
          MAX_HEIGHT,
        );
        return await page.screenshot({
          type: 'jpeg',
          quality: 75,
          fullPage: true,
          clip: { x: 0, y: 0, width: viewport.width, height: Math.max(height, viewport.height) },
        });
      } finally {
        await ctx.close();
      }
    };
    return {
      desktop: await shoot({ width: 1280, height: 800 }, false),
      mobile: await shoot({ width: 390, height: 844 }, true),
    };
  } finally {
    await browser.close();
  }
}
