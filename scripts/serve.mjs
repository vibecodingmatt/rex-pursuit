import http from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(process.cwd());
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.wav':'audio/wav','.mp3':'audio/mpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
 try{
  if(req.method==='POST'&&(req.url==='/__review'||req.url==='/__asset')){
   const chunks=[];for await(const chunk of req){chunks.push(chunk);if(chunks.reduce((n,c)=>n+c.length,0)>40e6)throw Error('Too large');}
   await mkdir(resolve(root,'art/review'),{recursive:true});await writeFile(resolve(root,req.url==='/__asset'?'public/models/rex-encounter.glb':'art/review/browser-report.json'),Buffer.concat(chunks));res.end('ok');return;
  }
  let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p==='/')p='/index.html';
  let file=resolve(root,'.'+p);if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{await stat(file);}catch{file=resolve(root,'public','.'+p);}
  const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(5188,'127.0.0.1',()=>console.log('Rex encounter: http://127.0.0.1:5188'));
