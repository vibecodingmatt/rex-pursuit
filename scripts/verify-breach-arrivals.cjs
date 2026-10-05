const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[],rows=[];fs.mkdirSync('art/review/breach-arrivals',{recursive:true});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto('http://127.0.0.1:5188/breach.html?menu=1');await p.waitForFunction(()=>window.breach?.ready,null,{timeout:120000});await p.locator('#start').click();await p.waitForFunction(()=>breach.mode==='playing');await p.evaluate(()=>breach.freeze=true);
  for(const [name,width,height,tier,view]of [['first',1440,900,'high','first'],['third',1440,900,'high','third'],['phone',390,844,'low','first'],['landscape',844,390,'low','third']]){
   await p.setViewportSize({width,height});
   await p.evaluate(({tier,view})=>{const b=breach,q=document.getElementById('quality');q.value=tier;q.onchange();if(b.view!==view)document.getElementById('view').click();b.step(0);},{tier,view});
   for(const species of ['raptor','pachycephalosaurus'])for(const lane of [0,1,2]){
    const result=await p.evaluate(async({species,lane})=>{
     const T=await import('/node_modules/three/build/three.module.js'),b=breach;b.director.reset();b.round.reset();b.round.time=20;
     const a=b.director.spawn(lane,species),c=a.c;b.director.update(0);b.scene.updateMatrixWorld(true);
     const mesh=c.kind.mesh,box=c.rig?new T.Box3().setFromObject(c.rig.root,true):new T.Box3().setFromBufferAttribute(mesh.geometry.attributes.position).expandByScalar(.15),rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),c.yaw);
     const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(b.camera.projectionMatrix,b.camera.matrixWorldInverse));
     let seen=0,probes=0;const exposed=[];
     for(const x of [box.min.x,(box.min.x+box.max.x)/2,box.max.x])for(const y of [box.min.y,(box.min.y+box.max.y)/2,box.max.y])for(const z of [box.min.z,(box.min.z+box.max.z)/2,box.max.z]){
      const v=new T.Vector3(x,y,z);if(!c.rig)v.multiplyScalar(c.scale).applyQuaternion(rotation).add(c.p);probes++;if(v.y>=0&&frustum.containsPoint(v)&&b.world.clearEntryLine(b.camera.position,v)){seen++;exposed.push(v.toArray());}
     }
     const centre=c.p.clone();centre.y+=c.kind.centre*c.scale;b.aimAt(centre);b.shoot();const hp=c.hp;
     // A blast on the front face must not kill a hidden animal through concrete.
     b.director.blast(new T.Vector3(a.side*17.25,1.5,34.69));const afterBlast=c.hp;
     const scale=c.scale;let previous=c.p.clone(),maxStep=0,entryEvents=0,wallContacts=0;
     while(a.phase==='approach'){
      const was=a.entered;b.director.update(1/60,{spawnEnabled:false});maxStep=Math.max(maxStep,c.p.distanceTo(previous));previous.copy(c.p);if(!was&&a.entered)entryEvents++;
      if(c.fade!==1||c.scale!==scale)throw Error('Arrival grows or fades in view');
      const body=c.p.clone();body.y+=c.kind.centre*c.scale;if(b.world.coverBounds.some(box=>box.containsPoint(body)))wallContacts++;
     }
     return {species,lane,seen,probes,exposed,hp,afterBlast,expectedHP:a.heavy?10:5,maxStep,entryEvents,wallContacts,bounds:{min:box.min.toArray(),max:box.max.toArray()},position:c.p.toArray()};
    },{species,lane});
    rows.push({name,...result});if(result.seen)console.log(result);assert.equal(result.seen,0,`${name}/${species}/${lane}: full spawn silhouette is concealed`);assert.equal(result.hp,result.expectedHP,'Concrete blocks bullets');assert.equal(result.afterBlast,result.expectedHP,'Concrete blocks blast damage');assert.equal(result.entryEvents,1);assert.equal(result.wallContacts,0,'Path avoids solid entrance walls');assert.ok(result.maxStep<.45,'No positional jump on emergence');
   }
   // Comparable natural entry frames, with the actual view/quality and HUD.
   await p.evaluate(()=>{const b=breach;b.director.reset();b.round.reset();b.round.time=3;window.arrival=b.director.spawn(0);b.aimAt(b.camera.position.clone().set(0,2,20));b.step(0);});
   if(name==='first')await p.screenshot({path:'art/review/breach-arrivals/after-birth.png'});
   await p.evaluate(()=>{const b=breach;while(!arrival.entered)b.step(1/60);for(let i=0;i<30;i++)b.step(1/60);});await p.screenshot({path:`art/review/breach-arrivals/${name}-emergence.png`});
   const switchesVisible=await p.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js'),b=breach;return b.world.switches.every(sw=>{const box=new T.Box3().setFromObject(sw);return [box.min,box.max].every(p=>{p.project(b.camera);return Math.abs(p.x)<1&&Math.abs(p.y)<1;});});});assert.equal(switchesVisible,true,'Both electrical switches stay in the playable view');
   if(name==='first'){
    await p.evaluate(()=>{breach.camera.fov=25;breach.camera.updateProjectionMatrix();});await p.screenshot({path:'art/review/breach-arrivals/entrance-detail.png'});
    await p.evaluate(()=>{breach.camera.fov=56;breach.camera.updateProjectionMatrix();const b=breach;b.director.reset();b.round.reset();b.round.time=20;window.arrival=b.director.spawn(2,'pachycephalosaurus');while(!arrival.entered)b.step(1/60);for(let i=0;i<30;i++)b.step(1/60);});await p.screenshot({path:'art/review/breach-arrivals/pachy-emergence.png'});
   }
   assert.equal(await p.evaluate(()=>breach.world.switches.every(sw=>{const b=breach;b.round.trap=0;b.round.shotTimer=0;b.aimAt(sw.getWorldPosition(sw.position.clone()));b.shoot();return b.round.trap>0;})),true,'Both relocated switches can be shot');
  }
  const cover=await p.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js'),b=breach,from=new T.Vector3(17.25,1.5,34.7);return {front:b.world.clearEntryLine(from,new T.Vector3(17.25,1.5,30)),behind:b.world.clearEntryLine(from,new T.Vector3(17.25,1.5,40))};});assert.deepEqual(cover,{front:true,behind:false},'Wall impacts splash outward, never through the wall');
  const gate=await p.evaluate(()=>{const b=breach,g=b.world.entryGates[0];b.world.arrival(g.side);b.world.update(.1,b.round);const before=g.hinge.rotation.y;b.world.update(0,b.round);const paused=before===g.hinge.rotation.y;b.world.reset();return {paused,pulse:g.pulse,angle:g.hinge.rotation.y,rest:g.side*1.7};});assert.equal(gate.paused,true);assert.equal(gate.pulse,0);assert.equal(gate.angle,gate.rest);
  assert.deepEqual(errors,[]);fs.writeFileSync('art/review/breach-arrivals/report.json',JSON.stringify(rows,null,2));console.log('Arrivals passed: 24 full-silhouette concealment checks, full-size continuous paths, solid cover, High/Low, first/third person and phone views. No runtime/shader errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
