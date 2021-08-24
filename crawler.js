fs = require('fs');
const puppeteer = require('puppeteer');

async function autoScroll(page){
    await page.evaluate(async () => {
        await new Promise(resolve => {
            const scrollHeight = document.body.scrollHeight;
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;
                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 120);
        });
    });
}

try {
    (async () => {

        const browser = await puppeteer.launch({
            ignoreHTTPSErrors: true,
            userDataDir: "/Users/krs/Puppeteer_User_Data",
            defaultViewport: null,
            devtools: true,
            headless:false,
            // dumpio: true,  //"pipe browser process stdout and stderr into process.stdout and process.stderr"
            args: ['--no-sandbox'] //, '--disable-gpu', '--disable-dev-shm-usage' , '--start-maximized'
        });
        // const page = await browser.pages()[0];
        const pages = await browser.pages();
        const page = pages[0];
        await page.goto("https://www.wine-world.com.hk/web/list.html", { waitUntil: 'networkidle0'});
        // await page.goto("https://bot.incolumitas.com/", { waitUntil: 'networkidle0'});
        // await page.waitForSelector('#pageList');
        // await page.mouse.down({button: 'end'});
        page.on('console', msg => console.log(msg.text()));
        // page.on('console', msg => {
        //     for (let i = 0; i < msg.args().length; i++) {
        //       console.log(msg.args()[i]);
        //     }
        //   });
        // const [el] = await page.$x('/html/body/div[1]');
        // var xx =  await page.evaluate(el=>{
        //     var selected_style_props = ['display', 'visibility', 'opacity', 'z-index', 'background-image', 'content', 'width', 'height'];
        //     var x = window.getComputedStyle(el);
        //     selected_style_props.forEach(s => {
        //         console.log(" @@@ ", x[s]);
        //     });
        // }, el);
        const pathToJSFile = '/Users/krs/AutoSpider/webdextAlg.js';
        // const jsStr = fs.readFileSync(pathToJSFile, 'utf8');
        // var dom_tree = await page.evaluate(jsStr);
        // 
         //Tested OK for injecting js into page.
        await page.addScriptTag({path: "consoleSave.js"});
        await page.addScriptTag({path: "webdextAlg.js"});

        // const bodyHandle = await page.$('html');
        // const html = await page.evaluate(h => h.innerHTML, bodyHandle);  
        // console.log(" @@@ ", html); 
    
        //Uncaught TypeError: Cannot read property 'length' of null at Record.toJSON (webdextAlg.js:2010:46) 
        //at RecordSet.toJSON (webdextAlg.js:2104:44) at JSON.stringify (<anonymous>) at console.save (consoleSave.js:14:25) 
       
        await autoScroll(page);
        console.log("Scrolling...");
        await page.waitForTimeout(500);
        var xcx =  await page.evaluateHandle(() => {
            // return Webdext.extract()
            console.log("start extracting!");
            var result = Webdext.extract();
            // console.log("result ", result);
            console.log("result len", result.length);
            // localStorage.setItem('resultcRec', JSON.stringify(result));
            // console.log("resultcRec saved!");
            // console.save(result);
            // console.save(JSON.parse(localStorage.getItem('resultcRec')));
            // console.log( JSON.stringify(result));
            
            // result.forEach(element => {
            //     console.log( element);
            // });
            // let cc = Webdext.XPath.getIndexedXPath(document.querySelector('.linkhref.nav-hw.oversea'));
            // const tds = Array.from(document.querySelectorAll('body>div'))
            // return tds.map(td => td.textContent);
          });
          
        // const arr = [];
        // const properties = await xcx.getProperties();
        // for (const property of properties.values()) {
        //     const elementHandle = property.asElement();
        //     if (elementHandle)
        //         arr.push(elementHandle);
        // }
        // await xcx.dispose();
        // arr.forEach(x=>
        //     console.log('x: ', x));

        //   console.log(" @@@ ",  xcx.asElement().innerHTML()); //await.jsonValue()

        // const text = await el.getProperty('textContent');
        // const name = await text.jsonValue();
        // console.log(text);
        // var p = await el.properties();

        // selected_style_props.forEach(s => {
        //     console.log(s, " @@@ ", xx[s]);
        // });

        
        // await browser.close();
    })()
} catch (err) {
    console.error(err)
}