import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

console.log(__dirname)
// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: [{ find: '@', replacement: '/src' }]
  },
  plugins: [vue()],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'lib/supergif.ts'),
      name: 'supergif',
      fileName: (format) => `supergif.${format}.js`
    },
    rollupOptions: {
      // 确保外部化处理那些你不想打包进库的依赖
      external: ['vue', 'sass'],
      output: {
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        globals: {
          vue: 'Vue'
        }
      }
    }
  }
})
