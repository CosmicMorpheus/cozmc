import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WalletProvider } from '@txnlab/use-wallet-react'
import { App } from './App'
import { ChainDataProvider } from './lib/data'
import { ToastProvider } from './components/ui'
import { MeProvider } from './components/Wallet'
import { ShareProvider } from './components/Share'
import { manager } from './lib/wallets'
import './styles.css'

// installable + offline arcade (production only: a dev service worker would cache Vite's modules)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* site works without it */ }) })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider manager={manager}>
      <ChainDataProvider>
        <ToastProvider>
          <MeProvider>
            <ShareProvider>
              <App />
            </ShareProvider>
          </MeProvider>
        </ToastProvider>
      </ChainDataProvider>
    </WalletProvider>
  </StrictMode>,
)
