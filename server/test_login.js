const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.careerlink.vn/nha-tuyen-dung/login');
  
  const loginUrl = page.url();
  const inputs = await page.evaluate(() => {
    const email = document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]') || document.querySelector('input[name*="user"]');
    const pass = document.querySelector('input[type="password"]') || document.querySelector('input[name="password"]');
    const btn = document.querySelector('button[type="submit"]') || document.querySelector('form button');
    
    return {
      emailId: email ? email.id || email.name : 'NOT_FOUND',
      passId: pass ? pass.id || pass.name : 'NOT_FOUND',
      btnId: btn ? btn.id || btn.className : 'NOT_FOUND',
      emailType: email ? email.type : 'NOT_FOUND'
    };
  });
  
  console.log('Login Info:', { loginUrl, ...inputs });
  await browser.close();
})();
