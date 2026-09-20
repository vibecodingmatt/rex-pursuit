const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[],report=[];try{
 const p=await b.newPage({viewport:{width:1600,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.goto(process.env.TEST_URL||'http://127.0.0.1:5188/');await p.waitForFunction(()=>window.rexChase?.rex,{timeout:120000});
 for(const [view,width,height]of [['third',1600,1000],['first',1600,1000],['third',390,844]]){
  await p.setViewportSize({width,height});await p.evaluate(()=>rexChase.start());await p.evaluate(view=>{const r=rexChase;r.freeze=false;r.setView(view);r.state.transition('pursuit');r.state.phaseTime=0;r.state.nextDebris=Infinity;r.state.distance=21;},view);await p.waitForTimeout(500);await p.evaluate(()=>rexChase.state.beginAmbush());
  for(const t of [1.1,2.4,3.6,4.8,6.5,7.5]){
   await p.waitForFunction(t=>rexChase.state.phase==='flank'&&rexChase.state.phaseTime>=t,t);await p.evaluate(()=>rexChase.freeze=true);
   const sample=await p.evaluate(async()=>{
    const r=rexChase,T=await import('three'),saved=r.rex.meshes.map(m=>({m,mat:m.material,order:m.renderOrder})),target=new T.WebGLRenderTarget(240,150),pixels=new Uint8Array(240*150*4),mask=new T.MeshBasicMaterial({color:0xff00ff,toneMapped:false,fog:false,side:T.DoubleSide});
    for(const {m}of saved){m.material=mask;m.renderOrder=1000;}
    const measure=()=>{r.renderer.setRenderTarget(target);r.renderer.render(r.scene,r.camera);r.renderer.readRenderTargetPixels(target,0,0,240,150,pixels);let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>230&&pixels[i+1]<35&&pixels[i+2]>220)count++;return count;};
    const visiblePixels=measure(),surroundings=[],rexMeshes=new Set(r.rex.meshes);
    r.scene.traverse(o=>{if((o.isMesh||o.isPoints||o.isSprite)&&!rexMeshes.has(o)){surroundings.push([o,o.visible]);o.visible=false;}});
    const fullPixels=measure();for(const [o,visible]of surroundings)o.visible=visible;
    for(const {m,mat,order}of saved){m.material=mat;m.renderOrder=order;}r.renderer.setRenderTarget(null);mask.dispose();target.dispose();r.renderer.render(r.scene,r.camera);
    return{t:r.state.phaseTime,x:r.rex.actor.position.x,actorVisible:r.rex.actor.visible,visiblePixels,fullPixels,exposedFraction:fullPixels?visiblePixels/fullPixels:0};
   });report.push({view,width,...sample});await p.screenshot({path:`art/review/treeline-${view}-${width}-${t}.png`});
   assert.equal(sample.actorVisible,true,'The model must never be switched off');assert.ok(sample.visiblePixels<=sample.fullPixels,'Scenery cannot expose more of the Rex than the isolated silhouette');if(t>=2.4&&t<=4.8){assert.ok(sample.exposedFraction<.02,`Rex visible through treeline: ${JSON.stringify({view,width,...sample})}`);if(width===1600)assert.ok(sample.fullPixels>0,'Desktop checks must verify foliage concealment inside the camera frustum');}if(t===6.5)assert.ok(sample.x>0,'Return must use the departure side');await p.evaluate(()=>rexChase.freeze=false);
  }
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('art/review/treeline-verification.json',JSON.stringify({errors,report},null,2));console.log(JSON.stringify({errors,report},null,2));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
