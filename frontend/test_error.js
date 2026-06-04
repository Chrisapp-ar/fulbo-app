const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', response => console.log('RESPONSE:', response.status(), response.url()));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.failure().errorText, request.url()));

  try {
    await page.goto('http://localhost:5173/?league=test-league', { waitUntil: 'networkidle2' });
    console.log('Page loaded successfully');
    await new Promise(r => setTimeout(r, 3000));
  } catch (err) {
    console.error('Navigation error:', err);
  } finally {
    await browser.close();
  }
})();
