import {defineConfig} from 'vite';
export default defineConfig({
 base:'./',
 plugins:[{
  name:'omit-development-links',
  apply:'build',
  // Strip these anchors from the HTML itself so production never flashes them.
  // Source serving and the Vite dev server retain the authoring shortcuts.
  transformIndexHtml(html){return html.replace(/<a\b[^>]*\bdata-dev-only\b[^>]*>[\s\S]*?<\/a>/g,'');}
 }],
 build:{target:'es2022',chunkSizeWarningLimit:700,rollupOptions:{input:{chase:'index.html',lab:'model-lab.html',sounds:'sound-library.html'}}}
});
