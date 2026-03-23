const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    // Catch console errors
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await page.goto('http://localhost:5173/');
    
    // Wait for splash to go away
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await wait(3000);
    
    console.log("Clicking Kinematics node...");
    await page.evaluate(() => {
        const firstNode = document.querySelector('.topic-node');
        if(firstNode) firstNode.click();
    });
    
    await wait(1000);
    
    console.log("Clicking option 2...");
    await page.evaluate(() => {
        let opts = document.querySelectorAll('#options-0 .option-btn');
        if (opts.length > 2) opts[2].click();
    });
    
    console.log("Clicking CHECK...");
    await page.evaluate(() => document.querySelector('#btn-check').click());
    
    await wait(500);
    
    console.log("Clicking CONTINUE...");
    await page.evaluate(() => document.querySelector('#btn-continue').click());
    
    await wait(500);
    
    const isStep1Visible = await page.evaluate(() => {
        const cl = document.getElementById('accordion-step-1').className;
        return !cl.includes('hidden');
    });
    
    console.log("Is Step 2 visible?", isStep1Visible);
    
    await browser.close();
})();
