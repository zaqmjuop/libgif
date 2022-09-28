import { defineConfig } from 'vite'
import path from 'path'

let buildType = 'docs'

export default defineConfig({
  resolve: {
    alias: [{ find: '@', replacement: '/src' }]
  },
  server: {
    port: 3000,
    watch: {
      ignored: ['!**/node_modules/@zaqmjuop/libgif/dist/libgif.mjs']
    }
  },
  optimizeDeps: {
    exclude: ['@zaqmjuop/libgif']
  },
  plugins: [],
  build: {
    outDir: buildType === 'lib' ? 'dist' : 'docs',
    lib:
      buildType === 'lib'
        ? {
            entry: path.resolve(__dirname, 'lib/libgif.ts'),
            name: 'libgif',
            formats: ['es'],
            fileName: 'libgif'
          }
        : void 0
  },
  base: 'libgif', // git-page 基础路径
  preview: {
    port: 8080
  }
})
