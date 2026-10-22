import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Writes sw-manifest.js: the built files the service worker precaches so the arcade works offline.
    That's the app shell plus every tab; wallet SDKs are left out (connecting needs the network anyway). */
function precacheManifest(): Plugin {
  return {
    name: 'cozmc-precache-manifest',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = new Set<string>()
      const visit = (name: string) => {
        const c = bundle[name]
        if (!c || files.has(name)) return
        files.add(name)
        if (c.type !== 'chunk') return
        c.imports.forEach(visit)
        c.viteMetadata?.importedCss.forEach(css => files.add(css))
        c.dynamicImports.forEach(d => { const dc = bundle[d]; if (dc?.type === 'chunk' && dc.facadeModuleId?.includes('/src/tabs/')) visit(d) })
      }
      Object.values(bundle).forEach(c => { if (c.type === 'chunk' && c.isEntry) visit(c.fileName) })
      const list = [...files].sort().map(f => `/${f}`)
      const version = list.map(f => f.replace(/^.*-([\w-]{8})\.\w+$/, '$1')).join('').slice(0, 64)
      this.emitFile({ type: 'asset', fileName: 'sw-manifest.js', source: `self.__BUILD = ${JSON.stringify({ version, files: list })}\n` })
    },
  }
}

export default defineConfig({
  plugins: [react(), precacheManifest()],
  define: { global: 'globalThis' },
  build: {
    target: 'es2022',
    assetsDir: 'static',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // vendor code changes rarely: separate files so returning players keep them cached
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (/algosdk|@noble|hi-base32|tweetnacl|js-sha/.test(id)) return 'algosdk'
          if (/@txnlab[\\/]use-wallet(-react)?[\\/]/.test(id)) return 'wallets'   // the core only: each wallet's SDK stays lazy until you pick it
        },
      },
    },
  },
})
