import { chromium } from 'playwright';

async function runTestPage(browser, url, timeout = 30000) {
  console.log(`\nNavigating to ${url}...`);
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER PAGE ERROR:', err.message, err.stack));

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // Custom poll loop for title to be highly resilient
    const startTime = Date.now();
    let title = '';
    while (Date.now() - startTime < timeout) {
      title = await page.title();
      if (title === 'ALLPASS' || title === 'FAIL') {
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    if (title !== 'ALLPASS' && title !== 'FAIL') {
      throw new Error(`Timeout waiting for title to become ALLPASS or FAIL (current: "${title}")`);
    }

    const text = await page.evaluate(() => document.body.innerText);
    console.log(`Result Title: ${title}`);
    console.log(text.substring(0, 1000));
    await page.close();
    return title !== 'FAIL';
  } catch (err) {
    console.error(`Error running ${url}:`, err.message || err);
    await page.close();
    return false;
  }
}

async function runTests() {
  console.log("Launching headless browser...");
  const browser = await chromium.launch();

  const pages = [
    { url: 'http://localhost:8088/test/boot.html', timeout: 15000 },
    { url: 'http://localhost:8088/test/headless.html', timeout: 40000 },
    { url: 'http://localhost:8088/test/mechanics.html', timeout: 20000 },
    { url: 'http://localhost:8088/test/reach.html', timeout: 25000 },
    { url: 'http://localhost:8088/test/maptest.html', timeout: 15000 },
    { url: 'http://localhost:8088/test/stomp_repro.html', timeout: 15000 }
  ];

  let allPass = true;
  for (const p of pages) {
    const ok = await runTestPage(browser, p.url, p.timeout);
    if (!ok) allPass = false;
  }

  await browser.close();

  if (!allPass) {
    console.error("\nTEST SUITE FAILED");
    process.exit(1);
  } else {
    console.log("\nALL TEST PAGES PASSED SUCCESSFULLY");
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Error running tests:", err);
  process.exit(1);
});
