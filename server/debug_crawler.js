const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();
  await page.setViewport({width: 1280, height: 800});
  await page.goto('https://www.careerlink.vn/nha-tuyen-dung/thu-xin-viec-da-nhan?latest=true', {waitUntil: 'networkidle2'});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({path: 'careerlink_debug.png'});
  console.log('Screenshot saved, URL is:', page.url());
  const content = await page.content();
  const title = await page.title();
  console.log('Page Title:', title);
  console.log('Body length:', content.length);
  await browser.close();
})();
