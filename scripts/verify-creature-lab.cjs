// All catalogue entries use the real runtime geometry/materials. Exercise both
// tiers, selection races, inspection controls, phone layout and menu scrolling.
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[],root=process.env.TEST_ORIGIN||'http://127.0.0.1:5188',dir='art/review/creature-lab';fs.mkdirSync(dir,{recursive:true});
 const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});watch(page);await page.goto(root+'/creature-lab.html#dilophosaurus');await page.waitForFunction(()=>window.creatureLab?.active);
  const catalogue=await page.evaluate(()=>creatureLab.catalogue.map(s=>s.id));assert.equal(catalogue.length,20);const counts={};
  for(const tier of ['high','low']){
   await page.selectOption('#tier',tier);
   for(const name of catalogue){
    await page.evaluate(name=>creatureLab.select(name),name);await page.waitForFunction(name=>creatureLab.selected===name&&creatureLab.active,name);
    assert.equal(await page.locator('#status').textContent(),'');counts[`${name}/${tier}`]=await page.locator('#model-stats').textContent();
    await page.evaluate(()=>new Promise(requestAnimationFrame));
   }
  }
  assert.notEqual(counts['raptor/high'],counts['raptor/low']);assert.notEqual(counts['brachiosaurus/high'],counts['brachiosaurus/low']);
  await page.evaluate(()=>Promise.all([creatureLab.select('brachiosaurus'),creatureLab.select('rex'),creatureLab.select('raptor')]));
  assert.equal(await page.evaluate(()=>creatureLab.selected),'raptor');
  await page.selectOption('#tier','high');await page.evaluate(()=>creatureLab.select('dilophosaurus'));await page.selectOption('#motion','rest');await page.locator('#pause').click();await page.selectOption('#frill-mode','manual');
  for(const view of ['front','side'])for(const open of ['0','0.5','1']){
   await page.locator('#frill').fill(open);await page.locator('[data-view="'+view+'"]').click();await page.waitForTimeout(120);
   assert.equal(await page.evaluate(()=>creatureLab.active.critter.kind.frill.array[0]),Number(open));
   await page.screenshot({path:`${dir}/frill-${view}-${open}.png`});
  }
  const frozen=await page.evaluate(()=>[...creatureLab.active.critter.kind.pose.array]);await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>[...creatureLab.active.critter.kind.pose.array]),frozen);
  await page.selectOption('#surface','wire');assert.ok(await page.evaluate(()=>creatureLab.active.object.material.wireframe));await page.selectOption('#surface','skin');
  for(const name of ['rex','brachiosaurus','raptor']){await page.evaluate(name=>creatureLab.select(name),name);await page.locator('[data-view="three"]').click();await page.waitForTimeout(100);await page.screenshot({path:`${dir}/final-${name}.png`});await page.locator('[data-view="head"]').click();await page.screenshot({path:`${dir}/detail-${name}.png`});}
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>creatureLab.select('dilophosaurus'));await page.locator('[data-view="three"]').click();await page.screenshot({path:`${dir}/phone.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#roster [data-species="dragonfly"]').click();assert.equal(await page.evaluate(()=>creatureLab.selected),'dragonfly');
  await page.close();
  // Sample the animated menu from first parse onward, including font/layout
  // changes. Hiding the scrollbar must not prevent scrolling a short panel.
  const menu=await browser.newPage({viewport:{width:1440,height:800}});watch(menu);
  await menu.addInitScript(()=>{window.menuSamples=[];const sample=()=>{const e=document.querySelector('#start-screen .intro-copy');if(e)menuSamples.push({bar:getComputedStyle(e).scrollbarWidth,overflow:getComputedStyle(e).overflowY});if(menuSamples.length<300)requestAnimationFrame(sample);};requestAnimationFrame(sample);});
  await menu.goto(root+'/');await menu.waitForFunction(()=>window.rexChase?.mode==='menu');await menu.waitForTimeout(1400);assert.ok((await menu.evaluate(()=>menuSamples)).every(s=>s.bar==='none'&&s.overflow==='auto'));
  assert.equal(await menu.locator('.menu-footer a[href="./creature-lab.html"]').count(),1);await menu.screenshot({path:`${dir}/menu-desktop.png`});
  await menu.setViewportSize({width:844,height:270});const scroll=await menu.locator('.intro-copy').evaluate(e=>{e.scrollTop=10000;return{top:e.scrollTop,need:e.scrollHeight>e.clientHeight};});assert.ok(scroll.need&&scroll.top>0);await menu.screenshot({path:`${dir}/menu-landscape.png`});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({models:catalogue.length,tiers:2,errors,menuScroll:scroll},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
