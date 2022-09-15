import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: [{ find: '@', replacement: '/src' }]
  },
  server: {
    port: 3000,
  },
  plugins: [],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'lib/libgif.ts'),
      name: 'libgif',
      formats: ['es'],
      fileName: 'libgif'
    }
  }
})
