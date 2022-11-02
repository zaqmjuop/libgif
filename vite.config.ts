import { defineConfig } from 'vite'
import path from 'path'
import * as fs from 'fs'

const NAME = 'libgif'
const ASSETS_DIR = 'assets'
const OUT_DIR = 'dist'
const ASSETS_DIR_REGEXP = new RegExp(`${NAME}/${ASSETS_DIR}`, 'g')
const writeOutDir = (str: string) =>
  str.replace(ASSETS_DIR_REGEXP, `${NAME}/dist/${ASSETS_DIR}`)

function workerResolverPlugin() {
  return {
    name: 'worker-resolver',
    writeBundle(options, bundle: { [fileName: string]: any }) {
      const dir = options.dir
      Object.keys(bundle).forEach((fileName) => {
        const info = bundle[fileName]
        if (fileName.endsWith('mjs') && info.type === 'chunk') {
          const filePath = path.resolve(dir, fileName)
          const buffer = fs.readFileSync(filePath)
          const code = buffer.toString('utf8', 0)
          fs.writeFileSync(filePath, writeOutDir(code))
        }
      })
    }
  }
}

let buildType = 'lib'

export default defineConfig({
  resolve: {
    alias: [{ find: '@', replacement: '/src' }]
  },
  server: {
    port: 3000,
    watch: {
      ignored: [`!**/node_modules/@zaqmjuop/${NAME}/${OUT_DIR}/libgif.mjs`]
    }
  },
  optimizeDeps: {
    exclude: ['@zaqmjuop/libgif']
  },
  plugins: [],
  build: {
    outDir: buildType === 'lib' ? OUT_DIR : 'docs',
    lib:
      buildType === 'lib'
        ? {
            entry: path.resolve(__dirname, 'lib/libgif.ts'),
            name: 'libgif',
            formats: ['es'],
            fileName: 'libgif'
          }
        : void 0,
    rollupOptions: {
      plugins: [workerResolverPlugin()]
    }
  },
  base: 'libgif', // git-page 基础路径
  preview: {
    port: 8080
  }
})
