import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 从 package.json 读取版本号
import { readFileSync } from 'fs'
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))
const appVersion = packageJson.version

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1431,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'vendor-state': ['zustand'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-select',
            '@radix-ui/react-slot',
            '@radix-ui/react-toast',
          ],
          'vendor-tauri': [
            '@tauri-apps/api',
            '@tauri-apps/plugin-dialog',
            '@tauri-apps/plugin-process',
            '@tauri-apps/plugin-shell',
            '@tauri-apps/plugin-updater',
          ],
        },
      },
    },
  },
})