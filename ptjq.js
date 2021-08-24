import puppeteer from 'puppeteer';
import pkg from 'puppeteer-jquery';
const { pageExtend } = pkg;
// import { pageExtend } from 'puppeteer-jquery';

(async() =>{
    let browser = await puppeteer.launch({headless: true});
    let pageOrg = await browser.newPage();
    let page = pageExtend(pageOrg);
    await page.goto('https://dev.to/napolux/how-to-scrap-that-web-page-with-nodejs-and-puppeteer-811', {waitUntil: 'networkidle0'});
    // append a <H1>
    await page.jQuery('body').append(`<h1>Title</h1>`);
    // get the H1 value
    let title = await page.jQuery('h1').text();
    // chain calls
    console.log('title ', title);
    let text = await page.jQuery('body #article-body h3')
            //   .closest('blockquote')
            //   .css('color', 'yellow')
            //   .parent()
              .text();
    console.log('text ', text);
})();