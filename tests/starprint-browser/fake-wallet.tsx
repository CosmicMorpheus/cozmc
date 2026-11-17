// A stand-in for @txnlab/use-wallet-react in the Starprint panel's browser test: one connected wallet
// whose signing is recorded and then declined, so nothing is ever sent anywhere.
declare global { interface Window { __wallet: string; __signRequests: unknown[][] } }
export function useWallet() {
  return {
    activeAddress: window.__wallet,
    algodClient: null,
    signTransactions: async (txns: unknown[]) => { window.__signRequests.push(txns); throw new Error('User rejected the request') },
  }
}
