import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'

const srcPath = fileURLToPath(new URL('./src', import.meta.url))
const electronPath = fileURLToPath(new URL('./electron', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['electron-store'],
            },
          },
        },
      },
      preload: {
        input: path.join(electronPath, 'preload.ts'),
      },
    }),
  ] as PluginOption[],
  resolve: {
    alias: {
      '@': srcPath,
    },
  },
})
