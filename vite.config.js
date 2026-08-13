import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// TalkingHead loads its lip-sync processors with a RELATIVE dynamic import
// (`import("./lipsync-en.mjs")`). After bundling, TalkingHead lives in
// /assets/, so that import resolves to /assets/lipsync-*.mjs — but Vite copies
// public/ to the dist ROOT. This plugin mirrors the lipsync-*.mjs files into
// dist/assets/ so the runtime import resolves in production too.
function copyLipsyncToAssets() {
  let root, outDir, publicDir
  return {
    name: 'copy-lipsync-to-assets',
    apply: 'build',
    configResolved(cfg) {
      root = cfg.root
      outDir = cfg.build.outDir
      publicDir = cfg.publicDir
    },
    closeBundle() {
      const assetsDir = path.resolve(root, outDir, 'assets')
      if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })
      for (const f of fs.readdirSync(publicDir)) {
        if (/^lipsync-.*\.mjs$/.test(f)) {
          fs.copyFileSync(path.join(publicDir, f), path.join(assetsDir, f))
        }
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), copyLipsyncToAssets()],
  // TalkingHead pins three@^0.180 and npm nests a 2nd copy under it, while the
  // app uses three@0.185. Two Three.js instances in the prod bundle make GLTF
  // objects incompatible with TalkingHead ("Multiple instances of Three.js" ->
  // showAvatar throws `Cannot read properties of undefined (reading 'set')`).
  // Dedupe forces every `three` (and its /addons, /examples subpaths) to resolve
  // to the single top-level copy.
  resolve: {
    dedupe: ['three'],
  },
  optimizeDeps: {
    exclude: ['@met4citizen/talkinghead']
  },
  server: {
    port: 5174,
    proxy: {
      // Backend routes are under /aiapps/avatarchatbot/... — forward REST + the
      // /aiapps/avatarchatbot/avatar/live WebSocket to the local backend on :8000.
      '/aiapps': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true
      },
      // Kept for the older dev backend that used /api/... routes.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
