import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves a project repo under /<repo>/, so the deploy workflow sets BASE_PATH.
// Local dev and preview stay at the root.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

export default defineConfig({
  base: env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
})
