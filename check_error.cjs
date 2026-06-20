const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  page.on('requestfailed', request => console.log('BROWSER REQUEST FAILED:', request.url(), request.failure().errorText));

  await page.goto('http://localhost:5173/');
  await new Promise(r => setTimeout(r, 2000));
  
  // Try logging in as Motorista
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].type('OKT9410');
    await inputs[1].type('OKT9410');
    const btn = await page.$('button[type="submit"]');
    if (btn) await btn.click();
    await new Promise(r => setTimeout(r, 2000));
  }
  
  await browser.close();
})();
