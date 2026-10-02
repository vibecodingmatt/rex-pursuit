const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/',out='art/review/shared-raptors';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[],rows=[];
 try{const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await p.goto(new URL('breach.html',base).href);await p.waitForFunction(()=>window.breach?.ready,null,{timeout:120000});await p.locator('#start').click();await p.waitForFunction(()=>breach.mode==='playing');await p.evaluate(()=>breach.freeze=true);
  for(const tier of ['high','low']){
   await p.setViewportSize(tier==='high'?{width:1440,height:900}:{width:390,height:844});
   await p.evaluate(tier=>{const b=breach;b.director.reset();b.round.reset();b.combatFX.reset();const q=document.getElementById('quality');q.value=tier;q.onchange();window.subject=b.director.spawn(0);b.director.update(0);},tier);
   const stages=await p.evaluate(()=>{const b=breach,a=subject,c=a.c,seen=new Set();for(let i=0;i<900&&a.phase!=='board';i++){b.director.update(1/60,{spawnEnabled:false});seen.add(a.phase);}for(let i=0;i<20;i++)b.director.update(1/60,{spawnEnabled:false});b.step(0);return{stages:[...seen],phase:a.phase,oldVisible:c.kind.mesh.visible,mesh:c.rig.skin.name,textured:!!c.rig.skin.material.map,normal:!!c.rig.skin.material.normalMap};});
   assert.equal(stages.phase,'board');assert.ok(stages.stages.includes('leap'));assert.equal(stages.oldVisible,false);assert.equal(stages.mesh,'Dromaeosaur');assert.ok(stages.textured&&stages.normal);
   await p.screenshot({path:`${out}/${tier}-board.png`});
   const shot=await p.evaluate(()=>{const b=breach,c=subject.c;b.aimAt(c.rig.head);const hp=c.hp;b.shoot();return{hp:c.hp,before:hp,hits:b.round.hits};});assert.equal(shot.hp,shot.before-1,'head proxy follows the new skull');
   const death=await p.evaluate(()=>{const b=breach,c=subject.c,a=c.rig;const points=()=>a.contacts.flatMap(({mesh,points})=>points.map(({index})=>mesh.getVertexPosition(index,c.p.clone()).applyMatrix4(mesh.matrixWorld)));
    const before=points();b.critters.kill(c,c.p.clone().set(0,.1,1));b.critters.updateDirected(0);const after=points(),jump=Math.max(...after.map((v,i)=>v.distanceTo(before[i])));
    for(let i=0;i<360;i++)b.critters.updateDirected(1/60);const low=Math.min(...points().map(v=>v.y));return{jump,low,grounded:c.grounded,finite:points().every(v=>v.toArray().every(Number.isFinite))};});
   assert.ok(death.jump<.0001,'lethal hit preserves the exact articulated pose');assert.ok(death.low>-.03&&death.low<.2,'the actual new hide settles on the floor');assert.ok(death.grounded&&death.finite);rows.push({tier,...stages,shot,death});
   await p.screenshot({path:`${out}/${tier}-fall.png`});
   await p.evaluate(()=>{const b=breach;b.director.reset();b.round.reset();b.combatFX.reset();window.subject=b.director.spawn(0);for(let i=0;i<600&&subject.phase!=='windup';i++)b.director.update(1/60,{spawnEnabled:false});b.step(0);b.aimAt(subject.c.rig.body);b.grenade();for(let i=0;i<100&&b.combatFX.rocket.visible;i++)b.step(1/60);});
   const blast=await p.evaluate(()=>({on:subject.c.on,bursts:breach.combatFX.breakup.raptors?.stats.bursts,slots:breach.combatFX.breakup.raptors?.slots.length}));assert.equal(blast.on,false);assert.equal(blast.bursts,1);assert.equal(blast.slots,4);
   await p.screenshot({path:`${out}/${tier}-blast.png`});
   await p.keyboard.press('p');const held=await p.evaluate(()=>JSON.stringify(breach.combatFX.breakup.raptors.slots.map(s=>[s.life,...s.pieces.map(p=>p.group.position.toArray())])));await p.evaluate(()=>breach.step(1));assert.equal(await p.evaluate(()=>JSON.stringify(breach.combatFX.breakup.raptors.slots.map(s=>[s.life,...s.pieces.map(p=>p.group.position.toArray())]))),held);await p.locator('#resume').click();
   await p.evaluate(()=>{breach.director.reset();breach.combatFX.reset();});assert.ok(await p.evaluate(()=>!subject.c.rig.root.visible&&breach.combatFX.breakup.raptors.slots.every(s=>s.life===0)));
  }
  await p.goto(new URL('creature-lab.html',base).href);await p.waitForFunction(()=>window.creatureLab?.active,null,{timeout:120000});
  for(const name of ['raptor','ghostRaptor']){await p.evaluate(name=>creatureLab.select(name),name);const info=await p.evaluate(()=>{const c=creatureLab.active.critter;return{skinned:c.rig.skin.isSkinnedMesh,color:c.rig.skin.material.color.toArray(),meshes:c.rig.meshes.length};});assert.ok(info.skinned);rows.push({name,...info});await p.screenshot({path:`${out}/${name}-studio.png`});}
  assert.notDeepEqual(rows.at(-1).color,rows.at(-2).color,'rare raptor keeps its pale appearance');assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/report.json`,JSON.stringify(rows,null,2));console.log('Shared raptors: authored textured rig, leap/board, real skull shots, exact lethal-pose continuity, grounded falls, direct textured breakup, pause/reset, High/Low and pale variant passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
