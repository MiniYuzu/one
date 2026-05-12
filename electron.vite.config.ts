import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: {
          main: 'src/main/main.ts',
          engine: 'src/engine/engine.ts',
        },
        formats: ['cjs'],
        fileName: (_format, entryName) => `${entryName}.cjs`,
      },
      outDir: 'out',
    },
    resolve: {
      alias: {
        '@main': path.resolve('src/main'),
        '@engine': path.resolve('src/engine'),
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
        fileName: () => 'index.cjs',
      },
      outDir: 'out',
      emptyOutDir: false,
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
