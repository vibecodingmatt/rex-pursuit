import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{target:'es2022',chunkSizeWarningLimit:700,rollupOptions:{input:{chase:'index.html',lab:'model-lab.html',sounds:'sound-library.html'}}}});
