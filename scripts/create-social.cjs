const {chromium}=require('playwright-core');
const fs=require('node:fs');
const path=require('node:path');

// Package the approved artwork; no running game, overlays or creative retouching.
const root=path.resolve(__dirname,'..');
const source=path.join(root,'art/rex-pursuit-keyart-v2.png');
const output=path.join(root,'public/social/rex-pursuit-v3.jpg');

(async()=>{
 const dataUrl=`data:image/png;base64,${fs.readFileSync(source).toString('base64')}`;
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage();
  const jpeg=await page.evaluate(async src=>{
   const image=new Image();image.src=src;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;
   const context=canvas.getContext('2d');
   context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
   const scale=Math.max(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight);
   const width=canvas.width/scale,height=canvas.height/scale;
   // Keep the Rex's head inside the wide crop by anchoring at the top.
   context.drawImage(image,(image.naturalWidth-width)/2,0,width,height,0,0,canvas.width,canvas.height);
   return canvas.toDataURL('image/jpeg',.92).split(',')[1];
  },dataUrl);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,Buffer.from(jpeg,'base64'));
  console.log(`Created ${output} (1200x630, ${fs.statSync(output).size} bytes).`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
