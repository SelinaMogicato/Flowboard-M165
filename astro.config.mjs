// @ts-check
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import node from '@astrojs/node'

export default defineConfig({
  output: 'server',
  security: {
    checkOrigin: false,
  },
  adapter: node({
    mode: 'standalone',
  }),
  outDir: './dist',
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['mongodb'],
    },
  },
})
