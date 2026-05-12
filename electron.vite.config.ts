import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'src/main/main.ts',
        formats: ['cjs'],
        fileName: () => 'main.js',
      },
      outDir: 'out/main',
    },
    resolve: {
      alias: {
        '@main': path.resolve('src/main'),
        '@shared': path.resolve('src/shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'src/preload/index.ts',
        formats: ['cjs'],
        fileName: () => 'preload.js',
      },
      outDir: 'out/preload',
    },
    resolve: {
      alias: {
        '@shared': path.resolve('src/shared'),
      },
    },
  },
  renderer: {
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
    },
    resolve: {
      alias: {
        '@renderer': path.resolve('src/renderer'),
        '@shared': path.resolve('src/shared'),
      },
    },
  },
})
