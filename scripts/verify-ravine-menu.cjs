const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/',out='art/review/ravine-menu';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[];
 try{for(const [name,width,height,progress,touch]of [['desktop',1440,900,'unlocked',false],['phone',390,844,'completed',true],['compact',320,568,'fresh',true],['landscape',844,390,'unlocked',true],['storage-denied',390,844,'denied',true]]){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch});await ctx.addInitScript(progress=>{if(progress==='denied'){Object.defineProperty(window,'localStorage',{get(){throw Error('Storage denied');}});return;}localStorage.setItem('rex-pursuit-quality','low');if(['unlocked','completed'].includes(progress)&&!localStorage.getItem('rex-pursuit-campaign-v1'))localStorage.setItem('rex-pursuit-campaign-v1',JSON.stringify({version:1,ravine:true,completed:progress==='completed'}));},progress);
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(`${name}: ${e.message}`));p.on('console',m=>{if(m.type()==='error')errors.push(`${name}: ${m.text()}`);});p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await p.goto(base);await p.waitForFunction(()=>window.rexChase?.mode==='menu',null,{timeout:120000});await p.locator('#boot').waitFor({state:'hidden'});await p.waitForTimeout(1300);
  // Raptor Ravine is a hub tile: tap it (or arrow along the rail), then one START enters the chase.
  const tile=p.locator('[data-game-mode=ravine]');assert.equal(await tile.getAttribute('data-locked'),'false');
  if(touch)await tile.tap();else{await p.locator('[data-game-mode=pursuit]').focus();await p.keyboard.press('ArrowRight');}
  assert.equal(await p.evaluate(()=>rexChase.safariUI.selected),'ravine');assert.equal(await tile.getAttribute('aria-pressed'),'true');
  assert.match(await p.locator('#ravine-status').textContent(),progress==='unlocked'?/UNLOCKED/:progress==='completed'?/COMPLETED/:/AVAILABLE NOW/);
  const layout=await p.evaluate(()=>[...document.querySelectorAll('[data-game-mode=ravine],#start')].map(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{visible:!!hit&&el.contains(hit),top:r.top,bottom:r.bottom,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth};}));
  for(const l of layout){assert.ok(l.visible&&l.top>=0&&l.bottom<=height&&l.height>=44,JSON.stringify({name,layout}));assert.equal(l.overflow,false);}await p.waitForTimeout(700);await p.screenshot({path:`${out}/${name}.png`});
  if(touch)await p.locator('#start').tap();else{await p.locator('#start').focus();await p.keyboard.press('Enter');}
  await p.waitForFunction(()=>window.ravine?.ready&&ravine.mode==='playing',null,{timeout:120000});assert.equal(new URL(p.url()).searchParams.has('start'),false);assert.equal(await p.locator('#start-screen').isVisible(),false,'one menu choice enters the chase');
  if(progress==='fresh')assert.equal(await p.evaluate(()=>localStorage.getItem('rex-pursuit-campaign-v1')),null,'open entry never invents a Rex victory');
  if(['unlocked','completed'].includes(progress))assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('rex-pursuit-campaign-v1')).ravine),true);
  await p.reload();await p.waitForFunction(()=>window.rexChase?.mode==='menu',null,{timeout:120000});assert.equal(await p.evaluate(()=>rexChase.safariUI.selected),'ravine','reload returns to the hub on this chapter instead of replaying the start intent');
  await ctx.close();console.log(`${name}: hub tile, correct progress label, one-click entry and reload to the hub passed`);
 }assert.deepEqual(errors,[]);console.log('Ravine menu passed for saved winners, replay, older/unrecorded wins, compact phones, landscape, keyboard/touch and unavailable storage.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
