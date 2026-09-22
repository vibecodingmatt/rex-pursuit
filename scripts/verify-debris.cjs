const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[],report={};
 fs.mkdirSync('art/review',{recursive:true});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900}});
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto(process.env.TEST_URL||'http://127.0.0.1:5188/');await p.waitForFunction(()=>window.rexChase?.rex,{timeout:120000});
  await p.locator('#start').click();await p.waitForFunction(()=>rexChase.mode==='playing');
  await p.evaluate(()=>{const r=rexChase;r.state.transition('pursuit');r.state.nextDebris=Infinity;r.state.distance=18;});await p.waitForTimeout(500);
  report.variants=await p.evaluate(()=>{
   const r=rexChase,s=r.state;r.freeze=true;r.debris.reset();const sequence=[],samples=[];
   const resources=()=>{const ids=new Set();for(const root of [r.debris.root,r.debris.source])root.traverse(o=>{if(o.geometry)ids.add(o.geometry.uuid);});return [...ids].sort();},before=resources();
   for(let n=0;n<24;n++){
    s.debris=null;s.spawnDebris();const d=s.debris;d.branchZ=s.distance-8;r.debris.update(0,s,0);const name=r.debris.root.userData.variant;sequence.push(name);
    for(const side of [-1,1]){
     d.side=side;d.fromX=side*.55;r.debris.update(0,s,0);r.scene.updateMatrixWorld(true);
     const joint=r.debris.root.localToWorld(r.debris.root.position.clone().set(0,.75,0));
     const sourceJoint=r.debris.source.localToWorld(r.debris.root.position.clone().set(1.3,3.8,0));
     const attachedGap=joint.distanceTo(sourceJoint),attachedPosition=r.debris.root.position.clone(),attachedQuaternion=r.debris.root.quaternion.clone();
     d.status='active';d.fromZ=d.branchZ;d.age=0;d.brokenAt=s.time;r.debris.update(0,s,0);
     const releaseJump=attachedPosition.distanceTo(r.debris.root.position),releaseTurn=attachedQuaternion.angleTo(r.debris.root.quaternion);
     for(const u of [.05,.4,.8]){d.age=d.duration*u;r.debris.update(0,s,0);if(r.debris.root.userData.variant!==name)throw Error('Appearance changed in flight');}
     samples.push({name,side,attachedGap,releaseJump,releaseTurn,visible:r.debris.visible,projectiles:r.debris.root.children.filter(v=>v.visible).length});
     d.status='attached';d.age=0;d.brokenAt=null;
    }
    if(r.debris.source.userData.variant!==name)throw Error('Source/projectile mismatch');
   }
   const after=resources();r.debris.reset();return {sequence,samples,before,after,resetHidden:!r.debris.root.visible&&!r.debris.source.visible&&!r.debris.visible};
  });
  const v=report.variants;assert.deepEqual(v.before,v.after,'Hazards must reuse geometry');assert.ok(v.resetHidden);
  for(let i=0;i<v.sequence.length;i++){if(i)assert.notEqual(v.sequence[i],v.sequence[i-1]);if(i%6===0)assert.equal(new Set(v.sequence.slice(i,i+6)).size,6);}
  for(const s of v.samples){assert.ok(s.attachedGap<1e-6&&s.releaseJump<1e-6&&s.releaseTurn<1e-6,JSON.stringify(s));assert.ok(s.visible);assert.equal(s.projectiles,1);}
  // Show each actual pooled branch at a useful close-up scale for art review.
  await p.evaluate(async()=>{
   const T=await import('three'),r=rexChase,scene=new T.Scene();scene.background=new T.Color(0x23302b);
   scene.add(new T.HemisphereLight(0xe8f3da,0x59624c,2.8));const sun=new T.DirectionalLight(0xffe4bd,3);sun.position.set(-4,8,-5);scene.add(sun);
   const camera=new T.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);camera.position.set(0,0,-11);camera.lookAt(0,0,0);camera.updateMatrixWorld();
   document.querySelectorAll('body > :not(#scene-viewport):not(script)').forEach(e=>e.style.visibility='hidden');
   r.debris.root.children.forEach((branch,i)=>{const copy=branch.clone();copy.visible=true;copy.position.set(3-(i%3)*3,i<3?1.65:-1.4,0);copy.rotation.set(.1,.25,-.4);scene.add(copy);
    const label=document.createElement('div');label.textContent=branch.name;Object.assign(label.style,{position:'fixed',color:'#dce5d4',font:'16px sans-serif',textAlign:'center',width:'300px',zIndex:999});const point=copy.position.clone();point.y-=1.35;point.project(camera);label.style.left=`${(point.x*.5+.5)*innerWidth-150}px`;label.style.top=`${(.5-point.y*.5)*innerHeight}px`;document.body.append(label);
   });
   // Freeze stops simulation, but the game still renders; use its scene/camera.
   r.scene.children.forEach(o=>o.visible=false);r.scene.background.copy(scene.background);r.scene.fog=null;
   while(scene.children.length)r.scene.add(scene.children[0]);r.camera.copy(camera);r.renderer.render(r.scene,r.camera);
  });
  await p.screenshot({path:'art/review/debris-variants.png'});
  assert.deepEqual(errors,[]);fs.writeFileSync('art/review/debris-verification.json',JSON.stringify({errors,...report},null,2));
  console.log(JSON.stringify({errors,forms:[...new Set(v.sequence)],hazards:v.sequence.length,contactSamples:v.samples.length,geometries:v.after.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
