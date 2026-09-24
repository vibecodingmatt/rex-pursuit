const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[],report=[];
 try{
  for(const [name,width,height,touch,view]of [['first',1600,1000,false,'first'],['third',1600,1000,false,'third'],['phone',390,844,true,'first'],['small-phone',390,680,true,'first'],['compact-phone',320,568,true,'first'],['tablet',768,1024,true,'first'],['landscape',844,390,true,'first'],['phone-third',390,844,true,'third']]){
   if(process.env.TEST_VIEWS&&!process.env.TEST_VIEWS.split(',').includes(name))continue;
   const p=await browser.newPage({viewport:{width,height},isMobile:touch,hasTouch:touch});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});if(process.env.TEST_CONDITIONS)await p.addInitScript(c=>localStorage.setItem('rex-pursuit-conditions',c),process.env.TEST_CONDITIONS);await p.goto(base);await p.waitForFunction(()=>window.rexChase?.rex,{timeout:120000});await p.locator('#start').click();await p.waitForFunction(()=>rexChase.mode==='playing');
   await p.evaluate(view=>{const r=rexChase;r.setView(view);r.state.transition('pursuit');r.state.nextDebris=Infinity;r.state.distance=12.5;r.state.beginChallenge();},view);await p.waitForTimeout(850);
   const sites=await p.evaluate(()=>{
    const r=rexChase;r.freeze=true;const out=[],o=r.state.objective;
    // Probe each real mesh anchor, rather than depending on this run's draw.
    for(const t of r.targets.targets){
     r.state.phase='challenge';r.state.result=null;o.status='active';o.order=[t.id,(t.id+1)%r.targets.targets.length];o.current=0;o.hits=0;o.hitsRequired=1;r.targets.update(r.state);r.state.shotTimer=0;
     const point={...t.screen},visible=t.visible;r.aimAt(t.world);const hit=r.shoot();
     const controls=['#mission-clock','#challenge-card','#touch-fire','#touch-reload','#touch-grenade','.view-switch'].map(s=>{const e=document.querySelector(s),b=e.getBoundingClientRect();return{selector:s,x:b.x,y:b.y,right:b.right,bottom:b.bottom,shown:getComputedStyle(e).display!=='none'&&b.width>0&&b.height>0};});
     out.push({id:t.id,name:t.name,visible,hit,progress:o.current,point,controls});
    }
    for(const s of out)s.layoutIssues=[];
    for(const roar of [0,.5,1]){
     r.rex.update(0,r.state,r.state.time,10,{jaw:roar,roar});
     for(const t of r.targets.targets)for(let v=0;v<t.indices.length;v++){
      o.order=[t.id];o.current=0;o.variants[t.id]=v;r.targets.update(r.state);const p=t.screen;
      for(const b of out[t.id].controls.filter(b=>b.shown))if(!(p.x+p.radius<b.x||p.x-p.radius>b.right||p.y+p.radius<b.y||p.y-p.radius>b.bottom))out[t.id].layoutIssues.push({variant:v,roar,control:b.selector,point:{...p}});
     }
    }
    r.rex.update(0,r.state,r.state.time,10,{jaw:0,roar:0});r.state.beginChallenge();r.state.shotTimer=0;r.state.heat=0;r.targets.update(r.state);r.effects.update(.2,0);return out;
   });
   if(sites.some(s=>s.layoutIssues.length)){fs.writeFileSync(`art/review/pressure-layout-${name}.json`,JSON.stringify(sites,null,2));await p.screenshot({path:`art/review/pressure-layout-${name}.png`});}
   for(const s of sites){assert.equal(s.visible,true,`${name} ${s.name}: hidden anchor`);assert.equal(s.hit,true);assert.equal(s.progress,1,`${name} ${s.id}: target ray rejected`);assert.deepEqual(s.layoutIssues,[],`${name} ${s.id}: roaring variant covered by HUD ${JSON.stringify(s.layoutIssues[0])}`);for(const b of s.controls.filter(b=>b.shown)){const t=s.point;assert.ok(t.x+t.radius<b.x||t.x-t.radius>b.right||t.y+t.radius<b.y||t.y-t.radius>b.bottom,`${name} ${s.id}: target covered by ${b.selector}`);}}
   await p.screenshot({path:`art/review/pressure-targets-${name}.png`});
   const flight=await p.evaluate(()=>{const r=rexChase;r.state.spawnDebris();while(r.state.debris.status==='attached')r.state.tickDebris(1/60);const d=r.state.debris,samples=[];for(const height of [3.65,3.95])for(const side of [-1,1])for(let i=1;i<20;i++){d.height=height;d.side=side;d.age=d.duration*i/20;r.debris.update(0,r.state);samples.push({height,side,u:i/20,visible:r.debris.visible,...r.debris.screen});}d.height=3.8;d.side=1;d.age=.55;r.debris.update(0,r.state);return samples;});
   for(const t of flight){assert.ok(t.visible,`${name}: invisible incoming projectile`);for(const b of sites[0].controls.filter(b=>b.shown)){assert.ok(t.x+t.radius<b.x||t.x-t.radius>b.right||t.y+t.radius<b.y||t.y-t.radius>b.bottom,`${name}: debris covered by ${b.selector}: ${JSON.stringify(t)}`);}}
   await p.screenshot({path:`art/review/pressure-debris-${name}.png`});
   const interception=await p.evaluate(()=>{
    const r=rexChase,s=r.state,before={health:s.health,current:s.objective.current,jeep:s.jeep},hits=[];
    for(let i=0;i<s.debris.hitsRequired;i++){s.shotTimer=0;r.aimAt(r.debris.root.position);hits.push(r.shoot());}
    const after={health:s.health,current:s.objective.current,jeep:s.jeep,status:s.debris.status,count:s.debrisCleared,label:document.querySelector('#hit-label').textContent};
    return{before,after,hits,screen:r.debris.screen};
   });
   assert.ok(interception.hits.every(Boolean),`${name}: debris ray must hit`);assert.equal(interception.after.status,'cleared');assert.equal(interception.after.health,interception.before.health,'Debris shots cannot double-hit the Rex');assert.equal(interception.after.current,interception.before.current);assert.equal(interception.after.jeep,100);assert.equal(interception.after.label,'DEBRIS CLEARED');
   if(name==='first'){
    const he=await p.evaluate(()=>{const r=rexChase,s=r.state;s.spawnDebris();while(s.debris.status==='attached')s.tickDebris(1/60);s.debris.age=1;r.debris.update(0,s);s.ammo=40;s.startReload();s.grenade=0;r.aimAt(r.debris.root.position);return{hit:r.grenade(),reload:s.reload,status:s.debris.status,health:s.health};});assert.ok(he.hit&&he.reload>0);assert.equal(he.status,'cleared');
    // Real-time pause freezes both the separate projectile timer and the Rex timer.
    await p.evaluate(()=>{const r=rexChase;r.state.spawnDebris();while(r.state.debris.status==='attached')r.state.tickDebris(1/60);r.state.beginChallenge();r.freeze=false;});await p.waitForTimeout(150);await p.keyboard.press('p');const frozen=await p.evaluate(()=>({age:rexChase.state.debris.age,remaining:rexChase.state.objective.remaining,health:rexChase.state.jeep}));await p.waitForTimeout(250);assert.deepEqual(await p.evaluate(()=>({age:rexChase.state.debris.age,remaining:rexChase.state.objective.remaining,health:rexChase.state.jeep})),frozen);await p.keyboard.press('p');
    await p.evaluate(()=>{const s=rexChase.state;s.debris.age=s.debris.duration-.05;s.nextDebris=Infinity;});await p.waitForFunction(()=>rexChase.state.debris.status==='impact');assert.equal(await p.evaluate(()=>rexChase.state.jeep),92);
    await p.evaluate(()=>{const r=rexChase;r.state.transition('pursuit');r.state.phaseTime=0;r.state.shotTimer=0;r.state.reload=0;r.state.health=5600;r.state.nextDebris=Infinity;});await p.waitForTimeout(100);
    const label=await p.evaluate(()=>{const r=rexChase,t=r.targets.targets[0];r.rex.skin.getVertexPosition(t.indices[0],t.world);r.rex.skin.localToWorld(t.world);r.aimAt(t.world);r.shoot();return{text:document.querySelector('#hit-label').textContent,color:document.querySelector('#hit-marker').style.color,heads:r.state.headshots};});assert.ok(label.heads>0);assert.equal(label.text,'HIT');assert.equal(label.color,'rgb(238, 232, 201)');
    await p.evaluate(()=>rexChase.start());assert.equal(await p.evaluate(()=>rexChase.state.debris),null);assert.equal(await p.evaluate(()=>rexChase.debris.visible),false);
   }
   report.push({name,sites:sites.map(({controls,...s})=>s),interception});await p.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync('art/review/pressure-verification.json',JSON.stringify({errors,report},null,2));console.log(JSON.stringify({errors,views:report.map(r=>({name:r.name,sites:r.sites.length,interception:r.interception.after}))},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
