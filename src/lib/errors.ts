/* Wallet and network errors in plain words for visitors.
   A dropped connection or an Algorand node outage used to show raw text like
   "HTTP 404 for https://mainnet-api.algonode.cloud/v2/accounts/…". Known cases get a sentence;
   anything else (a node rejecting the transaction, say) keeps its own message, trimmed. */
const LOW_ALGO = /overspend|below min/i
const NETWORK = /failed to fetch|fetch failed|networkerror|network request failed|load failed|timed? ?out|(status|HTTP) (404|408|429|5\d\d)\b/i
const FROM_NODE = /status 4\d\d|TransactionPool|logic eval/i   // "rejected by…" from the chain is not the visitor cancelling
const CANCEL = /reject|cancel|closed|denied/i

export const NETWORK_TROUBLE = 'Couldn’t reach the Algorand network just now. Try again in a moment, unless your wallet shows it already went through.'

export function friendlyError(e: unknown, say: { cancelled: string; lowAlgo: string; prefix?: string; max?: number }) {
  const m = String((e as { message?: unknown })?.message ?? e)
  if (LOW_ALGO.test(m)) return say.lowAlgo
  if (NETWORK.test(m)) return NETWORK_TROUBLE
  if (CANCEL.test(m) && !FROM_NODE.test(m)) return say.cancelled
  return (say.prefix ?? '') + m.slice(0, say.max ?? 160)
}
