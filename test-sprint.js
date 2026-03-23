const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    // Catch console errors
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await page.goto('http://localhost:5173/');
    
    // Wait for splash to go away
    await page.waitForTimeout(1000);
    
    // Click Kinematics (index 0)
    console.log("Clicking Kinematics node...");
    const hubs = await page.$$('.topic-node');
    await hubs[0].click();
    
    await page.waitForTimeout(500);
    
    // Step 1
    console.log("Clicking option 2...");
    const optionsStep0 = await page.$$('#options-0 .option-btn');
    await optionsStep0[2].click();
    
    console.log("Clicking CHECK...");
    await page.click('#btn-check');
    
    await page.waitForTimeout(500);
    
    console.log("Clicking CONTINUE...");
    await page.click('#btn-continue');
    
    await page.waitForTimeout(500);
    
    const isStep1Visible = await page.evaluate(() => {
        const cl = document.getElementById('accordion-step-1').className;
        return !cl.includes('hidden');
    });
    
    console.log("Is Step 2 visible?", isStep1Visible);
    
    await browser.close();
})();
