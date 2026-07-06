import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import { builtinModules } from 'node:module'

const external = [
  ...builtinModules,
  ...builtinModules.map(m => `node:${m}`),
  'mongodb',
  'dotenv',
  'mqtt'
]

// https://vite.dev/config/
export default defineConfig({
  build: {
    minify: false
  },
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external
            }
          }
        }
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              external
            }
          }
        }
      },
    }),
  ],
})
