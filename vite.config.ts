import { defineConfig } from 'vite'
import path from 'path'

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
    outDir: "dist",
    lib: {
      entry: path.resolve(__dirname, 'lib/libgif.ts'),
      name: 'libgif',
      formats: ['es'],
      fileName: 'libgif'
    }
  },
  base: "libgif", // git-page 基础路径
  preview: {
    port: 8080
  }
})
