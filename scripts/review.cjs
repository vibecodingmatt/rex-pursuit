const { chromium } = require('playwright-core');
const fs=require('fs');
(async()=>{
 fs.mkdirSync('art/review',{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5188');await page.waitForFunction(()=>window.rexStudy,{timeout:60000});
 await page.waitForTimeout(1600);await page.screenshot({path:'art/review/portrait.png'});
 for(const view of ['side','detail','encounter']){await page.locator(`[data-view="${view}"]`).click();await page.waitForTimeout(1500);await page.screenshot({path:`art/review/${view}.png`});}
 console.log(JSON.stringify({errors,stats:await page.evaluate(()=>({drawCalls:rexStudy.renderer.info.render.calls,triangles:rexStudy.renderer.info.render.triangles,clip:rexStudy.sourceClip.duration}))}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
