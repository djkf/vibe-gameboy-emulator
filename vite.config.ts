import { defineConfig } from 'vite'

export default defineConfig({
  base: '/vibe-gameboy-emulator/', // Set to your repo name for GitHub Pages
  server: {
    port: 3000,
  },
  build: {
    target: 'es2020',
  },
})
