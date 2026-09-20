const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const errors=[],results=[];
 for(const [name,width,height] of [['desktop',1600,1000],['phone',390,844],['small-phone',390,680],['landscape',844,390]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::'))errors.push(m.text());});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:5188/model-lab.html');await page.waitForFunction(()=>window.rexStudy);await page.waitForTimeout(500);
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('.control-deck button,[data-view],#damage')].map(b=>{const r=b.getBoundingClientRect();return {name:b.textContent||b.id,x:r.x,y:r.y,w:r.width,h:r.height};})}));assert.equal(layout.overflow,false);
  for(const b of layout.controls)assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=width+1&&b.y+b.h<=height+1,`${name} clipped control: ${JSON.stringify(b)}`);
  await page.screenshot({path:`art/review/final-${name}.png`});
  if(name==='desktop'){
   for(const action of ['roar','bite','recoil','tail']){await page.locator(`[data-action="${action}"]`).click();assert.ok(await page.locator(`[data-action="${action}"]`).evaluate(b=>b.classList.contains('selected')));await page.evaluate(a=>rexStudy.poseAt(a,{roar:2,bite:.8,recoil:.35,tail:1.3}[a]),action);await page.screenshot({path:`art/review/final-${action}.png`});await page.locator('[data-action="idle"]').click();}
   await page.locator('[data-view="detail"]').click();await page.waitForTimeout(1400);await page.locator('#damage').fill('3');await page.locator('#damage').dispatchEvent('input');assert.equal(await page.locator('#damage-label').textContent(),'BLOODIED');await page.screenshot({path:'art/review/final-damage.png'});
   await page.locator('#pause').click();assert.match(await page.locator('#pause').textContent(),/Resume/);await page.locator('#pause').click();
   await page.locator('#light-mode').click();await page.screenshot({path:'art/review/final-studio.png'});
   await page.locator('#credits-open').click();assert.ok(await page.locator('#credits').isVisible());await page.locator('#credits-close').click();
   await page.locator('#hide-ui').click();assert.ok(await page.locator('#show-ui').isVisible());await page.locator('#show-ui').click();
   const stats=await page.evaluate(async()=>{const THREE=await import('/node_modules/three/build/three.module.js');rexStudy.rex.updateMatrixWorld(true);rexStudy.rex.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});const bb=new THREE.Box3().setFromObject(rexStudy.rex,true);return {triangles:rexStudy.renderer.info.render.triangles,drawCalls:rexStudy.renderer.info.render.calls,min:bb.min.toArray(),max:bb.max.toArray(),bones:rexStudy.bones.length};});results.push(stats);
  }
  await page.close();results.push({name,width,height,controls:layout.controls.length});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('art/review/verification.json',JSON.stringify({errors,results},null,2));console.log(JSON.stringify({errors,results},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
