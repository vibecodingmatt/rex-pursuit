import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const root='https://vibecodingmatt.github.io/rex-pursuit/';
const html=await readFile('dist/index.html','utf8');
const meta=name=>{const tag=html.match(new RegExp(`<meta\\s+(?:name|property)="${name}"[^>]*>`))?.[0];assert.ok(tag,`Missing ${name}`);return tag.match(/content="([^"]*)"/)[1];};
assert.match(html,/<title>Rex: Pursuit/);assert.ok(html.includes(`<link rel="canonical" href="${root}">`));
assert.equal(meta('og:url'),root);assert.equal(meta('og:type'),'website');assert.equal(meta('og:site_name'),'Rex: Pursuit');assert.equal(meta('twitter:card'),'summary_large_image');
assert.equal(meta('og:image'),meta('twitter:image'));assert.equal(meta('og:image:secure_url'),meta('og:image'));assert.ok(meta('og:image').startsWith(root));assert.equal(meta('og:image:width'),'1200');assert.equal(meta('og:image:height'),'630');
for(const key of ['description','og:title','og:description','og:image:alt','twitter:title','twitter:description','twitter:image:alt'])assert.ok(meta(key).length>20);
const image=await readFile(join('dist',meta('og:image').slice(root.length)));assert.ok(image.length>20000&&image.length<1000000);assert.equal(image.readUInt16BE(0),0xffd8,'Share image is a real JPEG');
const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);assert.equal(schema['@type'],'VideoGame');assert.equal(schema.url,root);assert.equal(schema.isAccessibleForFree,true);assert.equal(schema.image,meta('og:image'));
for(const path of ['models/rex-hero.glb','audio/catalog.json','audio/clip-01.wav','draco/draco_decoder.wasm','textures/jungle-branch.png','favicon.svg','icons/icon-32.png','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png','site.webmanifest','robots.txt','sitemap.xml'])assert.ok((await stat(join('dist',path))).size>0,`Missing ${path}`);
const manifest=JSON.parse(await readFile('dist/site.webmanifest','utf8'));assert.equal(manifest.name,'Rex: Pursuit');assert.equal(manifest.start_url,'./');
for(const file of ['index.html','model-lab.html','sound-library.html']){
 const page=await readFile(join('dist',file),'utf8');for(const [,url]of page.matchAll(/(?:src|href)="([^"#]+)"/g)){if(/^(https?:|data:|mailto:)/.test(url)||url==='./')continue;assert.ok(!url.startsWith('/'),`${file} has a domain-root asset: ${url}`);await stat(join('dist',url));}
}
assert.ok(!(await readdir('dist')).includes('audio_reference'));
console.log('Release passed: static social metadata, image, structured data, icons, runtime assets and Pages-safe entrypoint links.');
