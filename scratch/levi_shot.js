import { chromium } from 'playwright';

const outDir = process.argv[2] || '.';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 520 } });
page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

for (const [name, qs] of [
  ['levi_swim', 'frames=300'],
  ['levi_phase2', 'frames=400&phase=2'],
  ['levi_stunned', 'frames=260&stun=1'],
]) {
  await page.goto(`http://localhost:8088/scratch/levi_shot.html?${qs}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.title === 'DONE', null, { timeout: 20000 });
  // scale canvas 2x for readability
  await page.evaluate(() => {
    const c = document.getElementById('view');
    c.style.width = '640px';
    c.style.height = '480px';
    c.style.imageRendering = 'pixelated';
  });
  await page.locator('#view').screenshot({ path: `${outDir}/${name}.png` });
  console.log('wrote', name);
}
await browser.close();
