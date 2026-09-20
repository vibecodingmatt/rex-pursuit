const {chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log(e.message)});await page.goto('http://127.0.0.1:5188/model-lab.html?author=1');await page.waitForFunction(()=>window.rexStudy,{timeout:60000});console.log(await page.evaluate(()=>rexStudy.exportAsset()));
 await page.evaluate(()=>{rexStudy.setView('detail',true);rexStudy.poseAt('roar',2);});await page.waitForTimeout(100);await page.screenshot({path:'art/review/roar.png'});
 await page.evaluate(()=>{rexStudy.setDamage(3);rexStudy.poseAt('idle',0);});await page.waitForTimeout(100);await page.screenshot({path:'art/review/damage.png'});
 await page.evaluate(()=>{rexStudy.setView('encounter',true);rexStudy.setDamage(0);rexStudy.poseAt('bite',1);});await page.waitForTimeout(100);await page.screenshot({path:'art/review/bite.png'});
 console.log({errors});await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
