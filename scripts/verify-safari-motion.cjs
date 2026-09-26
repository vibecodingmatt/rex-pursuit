// Focused regression check for instanced Safari motion, including the actual GPU
// deformation (transform feedback), hit transforms and the live-to-dead handoff.
const {chromium}=require('playwright-core'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[];
 try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{let seed=0x516af;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  await page.goto('http://127.0.0.1:5188/');await page.waitForFunction(()=>window.rexChase?.mode==='menu');
  const result=await page.evaluate(async()=>{
   const r=rexChase,T=await import('/node_modules/three/build/three.module.js'),{SAFARI_GAIT_GLSL}=await import('/src/chase/safari-motion.js');
   await r.critters.ready();r.freeze=true;
   const require=(v,msg)=>{if(!v)throw Error(msg);},gl=document.createElement('canvas').getContext('webgl2');
   const program=gl.createProgram(),shader=(kind,source)=>{const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);require(gl.getShaderParameter(s,gl.COMPILE_STATUS),gl.getShaderInfoLog(s));gl.attachShader(program,s);};
   shader(gl.VERTEX_SHADER,`#version 300 es
    precision highp float;
    in vec3 position;in vec3 normal;in vec4 rig;in vec3 pivot;
    uniform vec4 aPose;uniform vec4 aBody;uniform mat4 model;
    out vec3 posed;
    ${SAFARI_GAIT_GLSL}
    void main(){vec3 p=position,n=normal;safariPose(p,n);posed=(model*vec4(p,1.)).xyz;gl_Position=vec4(posed,1.);}`);
   shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1.);}');
   gl.transformFeedbackVaryings(program,['posed'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);require(gl.getProgramParameter(program,gl.LINK_STATUS),gl.getProgramInfoLog(program));gl.useProgram(program);
   const loc=name=>gl.getUniformLocation(program,name),output=gl.createBuffer(),matrix=new T.Matrix4(),point=new T.Vector3(),rows=[];
   for(const tier of ['high','low'])for(const name of ['raptor','dilophosaurus','parasaurolophus','pachycephalosaurus','gallimimus','triceratops','stegosaurus']){
    r.setQuality(tier);r.critters.reset({empty:true});const c=r.critters.huntSpawn(name,1,20),k=c.kind,g=k.mesh.geometry,pos=g.attributes.position,rig=g.attributes.rig;
    c.vigor=1;c.cadence=1;c.away=0;c.swerve=0;c.jink=100;
    const ids=[];let arm=-1,torso=-1;
    for(let i=0;i<pos.count;i++){
     if(rig.getX(i)===3&&pos.getY(i)<.014&&rig.getY(i)>.9)ids.push(i);
     if(rig.getX(i)===4&&rig.getY(i)>.9)arm=i;
     if(rig.getX(i)===0&&Math.abs(pos.getY(i)-k.centre)<.04)torso=i;
    }
    require(ids.length>0,`${name}/${tier}: no toe samples`);require(torso>=0,`${name}/${tier}: no torso`);
    const toes=ids.length;ids.push(torso);if(arm>=0)ids.push(arm);require(k.quad||arm>=0,`${name}/${tier}: missing arm rig`);
    const buffers=[];
    for(const name of ['position','normal','rig','pivot']){const a=g.attributes[name],n=a.itemSize,data=new Float32Array(ids.length*n),buffer=gl.createBuffer(),location=gl.getAttribLocation(program,name);if(location<0)continue;
     ids.forEach((id,j)=>{for(let v=0;v<n;v++)data[j*n+v]=a.getComponent(id,v);});gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.vertexAttribPointer(location,n,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(location);buffers.push(buffer);}
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,ids.length*12,gl.DYNAMIC_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
    const data=new Float32Array(ids.length*3),heights=[],arms=[];let footMin=Infinity;
    for(let i=0;i<24;i++){
     c.p.set(0,0,20);c.phase=i/24;c.yaw=0;c.roll=0;c.v.set(0,0,c.run);r.critters.update(.000001,{speed:0,spawn:false});k.mesh.getMatrixAt(0,matrix);
     gl.uniform4fv(loc('aPose'),k.pose.array.slice(0,4));gl.uniform4fv(loc('aBody'),k.body.array.slice(0,4));gl.uniformMatrix4fv(loc('model'),false,matrix.elements);
     gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,ids.length);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,data);
     for(let j=0;j<toes;j++)footMin=Math.min(footMin,data[j*3+1]-c.p.y);
     heights.push(data[toes*3+1]-c.p.y);
     if(arm>=0){point.fromArray(data,(toes+1)*3).applyMatrix4(matrix.clone().invert());arms.push(point.y);}
     point.set(0,k.centre,0).applyMatrix4(matrix);const live=r.critters.live(name)[0];require(Math.abs(live.y-point.y)<1e-5,`${name}: target detached from body`);
     const ray=new T.Ray(point.clone().add(new T.Vector3(0,0,10)),new T.Vector3(0,0,-1));require(r.critters.hit(ray)?.critter===c,`${name}: moving body missed`);
    }
    const range=a=>Math.max(...a)-Math.min(...a),bob=range(heights),armRange=arm>=0?range(arms)*c.scale:0;
    require(bob>.015&&bob<.28,`${name}/${tier}: torso excursion ${bob}`);require(footMin>-.025,`${name}/${tier}: foot below ground ${footMin}`);
    require(k.quad||armRange>.02,`${name}/${tier}: rigid arms ${armRange}`);
    // Kill with exactly the current pose, then write at dt=0 without stepping the fall.
    const prior=matrix.clone();r.critters.kill(c,new T.Vector3(0,0,1));r.critters.update(Number.MIN_VALUE,{speed:0,spawn:false});k.mesh.getMatrixAt(0,matrix);
    require(matrix.elements.every((v,i)=>Math.abs(v-prior.elements[i])<1e-5),`${name}/${tier}: body pops on kill`);
    for(let i=0;i<300;i++)r.critters.update(1/60,{speed:0,spawn:false});require(c.grounded&&Number.isFinite(c.p.y),`${name}/${tier}: fall did not settle`);
    rows.push({name,tier,bob:+bob.toFixed(3),arm:+armRange.toFixed(3),footMin:+footMin.toFixed(4)});buffers.forEach(b=>gl.deleteBuffer(b));
   }
   // Even animals forced to start on the same beat drift apart at equal speed.
   r.critters.reset({empty:true});const herd=Array.from({length:6},()=>r.critters.huntSpawn('gallimimus',1,20));
   for(const c of herd){c.phase=.2;c.scale=5.5;c.run=8;c.away=0;c.swerve=0;c.jink=100;c.goal=-100;c.crossTime=100;c.v.set(-8,0,0);c.p.set(20,0,20);}
   for(let i=0;i<120;i++)r.critters.update(1/60,{speed:0,spawn:false});
   const cadence=herd.map(c=>c.cadence);require(Math.max(...cadence)-Math.min(...cadence)>.03,'herd has one cadence');require(new Set(herd.map(c=>c.phase.toFixed(2))).size>=3,'herd stays in sync');
   for(const name of ['compy','goldenCompy']){r.critters.reset({empty:true});const c=r.critters.huntSpawn(name,1,20);require(c.cadence===1&&c.vigor===1&&!c.kind.motion,`${name}: gait changed`);}
   require(gl.getError()===gl.NO_ERROR,'GPU feedback error');gl.getExtension('WEBGL_lose_context')?.loseContext();return {rows,cadence};
  });
  assert.deepEqual(errors,[]);console.log(JSON.stringify(result,null,2));console.log('Safari motion passed: both tiers, torso/arms, foot clearance, hit tracking, continuous kills, settled falls, independent herd cadence and unchanged compy tuning.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
