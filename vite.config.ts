import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: [{ find: '@', replacement: '/src' }]
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
