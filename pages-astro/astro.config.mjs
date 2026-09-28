import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
export default defineConfig({ output: 'server', adapter: vercel(), build: { assets: 'p/_astro', inlineStylesheets: 'always' }, devToolbar: { enabled: false } });
