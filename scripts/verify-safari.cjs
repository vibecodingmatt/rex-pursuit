const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{
 fs.mkdirSync('art/review/safari',{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[];
 const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};
 const open=async p=>{await p.goto(base);await p.waitForFunction(()=>window.rexChase?.mode==='menu',null,{timeout:120000});await p.waitForTimeout(1500);};
 let p;
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720}});p=await context.newPage();watch(p);await open(p);
  await p.locator('[data-game-mode=safari]').click();
  // The Safari title screen hides the Rex and parades the roster instead.
  await p.waitForTimeout(3500);const menu=await p.evaluate(()=>({rex:rexChase.rex.actor.visible,crossing:['compy','gallimimus','raptor','pachycephalosaurus','dilophosaurus','parasaurolophus','triceratops','stegosaurus','ghostRaptor','goldenCompy','lizard'].reduce((n,k)=>n+rexChase.critters.live(k).length,0),mode:localStorage.getItem('rex-pursuit-mode')}));
  assert.equal(menu.rex,false);assert.ok(menu.crossing>0,'Safari menu parade');assert.equal(menu.mode,'safari');
  await p.locator('#guide-open').click();assert.equal(await p.locator('.species-row').count(),15);await p.locator('#guide-close').click();await p.screenshot({path:'art/review/safari/menu.png'});
  await p.locator('#start').click();await p.waitForFunction(()=>rexChase.mode==='playing');assert.equal(await p.evaluate(()=>rexChase.rex.actor.visible),false);
  await p.waitForFunction(()=>rexChase.state.safari.ready===0);await p.waitForTimeout(5000);
  const natural=await p.evaluate(()=>({snapshot:rexChase.snapshot(),live:rexChase.critters.live('compy').length+rexChase.critters.live('gallimimus').length,quality:rexChase.quality}));console.log('Natural safari',JSON.stringify(natural));
  await p.screenshot({path:'art/review/safari/play.png'});
  await p.keyboard.press('p');const time=await p.evaluate(()=>rexChase.state.fightTime);await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>rexChase.state.fightTime),time);await p.locator('#resume').click();
  // Aim through the real game raycaster: common, multi-hit and legendary targets.
  const kills=await p.evaluate(()=>{
   const r=rexChase;r.freeze=true;r.critters.reset({empty:true});r.flyers.reset({empty:true});r.birds.reset();
   const out=[];
   for(const kind of ['compy','goldenCompy','raptor','pachycephalosaurus','dilophosaurus','parasaurolophus','stegosaurus','triceratops','ghostRaptor','quetzalcoatlus']){
    r.critters.reset({empty:true});r.flyers.reset({empty:true});const c=r.safariDirector.spawn(kind,23);if(!c)throw Error('No '+kind);
    c.p.x=0;c.p.z=23;c.p.y=kind==='quetzalcoatlus'?5:0;c.v.set(0,0,0);c.yaw=Math.PI/2;
    const air=kind==='quetzalcoatlus';r.critters.update(.001,{speed:0,spawn:false});r.flyers.update(.001,{speed:0,spawn:false});r.scene.updateMatrixWorld(true);
    const target=c.p.clone();if(!air)target.y+=c.kind.centre*c.scale;
    const before=r.state.safari.score,hp=c.hp;r.aimAt(target);
    for(let i=0;i<hp;i++){r.state.shotTimer=0;r.state.heat=0;r.state.overheated=false;r.state.ammo=80;r.shoot();if(i<hp-1&&c.state==='dead')throw Error('Died early '+kind);}
    out.push({kind,hp,dead:c.state==='dead',points:r.state.safari.score-before});
   }
   // A direct grenade delivers one four-hit blast, never direct+blast double damage.
   r.critters.reset({empty:true});r.flyers.reset({empty:true});const c=r.safariDirector.spawn('ghostRaptor',23);c.p.set(0,0,23);c.v.set(0,0,0);r.critters.update(.001,{speed:0,spawn:false});const at=c.p.clone();at.y+=c.kind.centre*c.scale;r.aimAt(at);r.state.grenade=0;r.grenade();out.push({kind:'grenade',hp:c.hp});
   r.freeze=false;return out;
  });console.log('Real shooting',JSON.stringify(kills));for(const k of kills.slice(0,-1)){assert.equal(k.dead,true,k.kind);assert.ok(k.points>0,k.kind);}assert.equal(kills.at(-1).hp,5);
  await p.evaluate(()=>{rexChase.state.tick(90);});await p.waitForFunction(()=>rexChase.mode==='ended');assert.equal(await p.locator('#safari-results').isVisible(),true);assert.ok((await context.cookies()).some(c=>c.name==='rex_safari_v1'));
  const score=await p.evaluate(()=>rexChase.state.safari.score);await p.waitForTimeout(900);await p.screenshot({path:'art/review/safari/results.png'});
  await p.locator('#restart').click();await p.waitForFunction(()=>rexChase.mode==='playing');assert.equal(await p.evaluate(()=>rexChase.state.safari.score),0);assert.equal(await p.evaluate(()=>rexChase.state.jeep),100);
  await p.keyboard.press('p');await p.locator('#pause-screen [data-menu]').click();await p.locator('[data-game-mode=pursuit]').click();await p.locator('#start').click();await p.waitForFunction(()=>rexChase.mode==='playing');assert.equal(await p.evaluate(()=>rexChase.state.safari),null);await p.evaluate(()=>rexChase.state.transition('pursuit'));await p.waitForFunction(()=>rexChase.rex.actor.visible);
  await open(p);await p.locator('[data-game-mode=safari]').click();assert.ok((await p.locator('#safari-best').innerText()).includes(score.toLocaleString()));await p.close();
  const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});p=phone;watch(phone);await open(phone);await phone.locator('[data-game-mode=safari]').tap();await phone.screenshot({path:'art/review/safari/phone-menu.png'});await phone.locator('#start').tap();await phone.waitForFunction(()=>rexChase.state.safari?.ready===0);await phone.waitForTimeout(1800);
  assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const fire=await phone.locator('#touch-fire').boundingBox(),session=await phone.context().newCDPSession(phone);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:130,y:370,id:1},{x:fire.x+fire.width/2,y:fire.y+fire.height/2,id:2}]});await phone.waitForTimeout(300);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(await phone.evaluate(()=>rexChase.state.ammo<80));
  await phone.screenshot({path:'art/review/safari/phone-play.png'});await phone.setViewportSize({width:844,height:390});await phone.waitForTimeout(300);await phone.screenshot({path:'art/review/safari/phone-landscape.png'});
  assert.deepEqual(errors,[]);console.log('Safari browser passed: Rex-free Safari title parade, remembered mode, mode selection, 15-species field guide, visible wildlife, multi-hit scoring, grenade damage, pause, finish, cookie/reload, restart, chase return, simultaneous touch fire/aim, portrait and landscape.');
 }catch(e){if(p&&!p.isClosed())await p.screenshot({path:'art/review/safari/failure.png'});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
