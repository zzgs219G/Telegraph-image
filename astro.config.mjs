import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true }
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['node:http', 'node:https', 'node:url', 'node:stream', 'node:zlib', 'node:util', 'node:crypto', 'node:fs', 'node:path', 'node:assert', 'node:net', 'node:tls', 'node:tty', 'node:events', 'node:http2'],
    }
  }
});
