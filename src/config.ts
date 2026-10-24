/* ============================================================
   COZMC site config — the one file you'll most likely edit.
   ============================================================ */

/** Official channels. Leave "" for any you don't have yet ("Coming soon"). */
export const SOCIAL = {
  x: '',        // e.g. "https://x.com/cozmc"
  discord: 'https://discord.gg/UUyC6aw9W',
  telegram: '',
  email: '',    // e.g. "hello@yourdomain.com"
}

/** Background music (YouTube video ids), played in order and looped. Leave empty to remove the music button. */
export const MUSIC_IDS = ['O9QgHF1gtC8', 'B0Bwoh948QQ']

// ---- token ----
export const ASA_ID = 3739851986
export const ASA_DECIMALS = 6
export const ASA_TOTAL = 1_000_000_000
export const CREATOR = 'JM2AUDGBHZYIIN5MFP4VPKKAGJH27PWI3XXITX4UAHSQQ5ZL7BAGD72YOQ'
/** The live site, used in share posts. */
export const SITE_URL = 'https://cozmc.us'
export const HAYSTACK_INVITE = 'https://links.hay.app/invite?ref=go2dglG2YeuDyFMozQpSN'

// ---- the Bonfire (ARC-54 burn app — anything sent here can never leave) ----
export const BONFIRE_APP_ID = 1257620981
export const BONFIRE_ADDRESS = 'BNFIREKGRXEHCFOEQLTX3PU5SUCMRKDU7WHNBGZA4SXPW42OAHZBP7BPHY'

// ---- network ----
export const ALGOD = 'https://mainnet-api.algonode.cloud'
export const INDEXER = 'https://mainnet-idx.algonode.cloud'
export const EXPLORER_TX = (id: string) => `https://allo.info/tx/${id}`
export const EXPLORER_ACCOUNT = (a: string) => `https://allo.info/account/${a}`

/** Daily Challenge #1 is this UTC date. Days roll over at 00:00 UTC. */
export const DAILY_START = '2026-10-17'

/**
 * The community burn goal shown in the fire strip. Set the amount and what
 * reaching it means; it tracks the Bonfire's total COZMC automatically.
 */
export const BURN_GOAL = { amount: 10_000_000, reward: 'unlocks the next arcade game' }

/** On-chain note prefixes. Changing these orphans existing burns/scores — don't. */
export const NOTE_BURN = 'cozmc:burn:v1:'
export const NOTE_SCORE = 'cozmc:arcade:v1:'
/** Scores are only read from this round onward (keeps the indexer search fast). */
export const ARCADE_START_ROUND = 66_060_000

/**
 * Posting a score costs SCORE_FEE_ALGO. In the same signature it buys COZMC on the
 * Pact ALGO/COZMC pool and burns all of it in the Bonfire. Only scores whose
 * transaction group contains that burn count on the boards.
 */
export const SCORE_FEE_ALGO = 0.1
export const PACT_POOL_APP = 3744648325        // Pact ALGO/COZMC weighted pool
export const PACT_LP_ASSET = 3744648328        // its LP token
export const PACT_URL = 'https://pact.fi'
/**
 * Pact farms that take COZMC or the ALGO/COZMC LP token. The site also discovers new ones from
 * Pact's public API; this list is the fallback if that API is down. Staked COZMC (and the COZMC
 * inside staked LP) still counts toward a holder's rank on the Holders board.
 */
export const PACT_FARMS: { id: number; stakes: number; name: string }[] = [
  { id: 3745441549, stakes: 3744648328, name: 'ALGO / COZMC' },
  { id: 3745445228, stakes: 3739851986, name: 'COZMC' },
]
export const PACT_VAULT_APP = 3656084807       // Pact Vault (holds the pool's reserves; swaps pay into it)
export const SCORE_SLIPPAGE = 0.03             // burn at least 97% of the quoted COZMC
/**
 * The weekly giveaway. Every score posted in a week is one ticket, plus one free ticket per
 * wallet per week ("no purchase necessary"). Weeks run Monday 00:00 UTC to the next Monday.
 * After the week ends, the winner is drawn from the seed of the first Algorand block at or after
 * the deadline. The prize is sent from `payer` with a prize note, and the site shows it as paid.
 */
export const GIVEAWAY = {
  start: '2026-10-19',            // a Monday: week 1 begins here (UTC)
  prize: 100_000,                 // COZMC, every week unless overridden below
  prizes: {} as Record<number, number>,   // per-week overrides, e.g. { 4: 250_000 }
  extras: {} as Record<number, string>,   // optional bonus text per week, e.g. { 4: 'plus a custom Moonshot skin' }
  payer: 'JM2AUDGBHZYIIN5MFP4VPKKAGJH27PWI3XXITX4UAHSQQ5ZL7BAGD72YOQ',   // the creator wallet; can't win
  checkinDays: 5,                 // Cozmling check-ins on this many different days in a week earn one bonus ticket
}
export const NOTE_TICKET = 'cozmc:ticket:v1:'
export const NOTE_PRIZE = 'cozmc:prize:v1:'
/** Each wallet's Cozmling is saved as a 0-ALGO note to itself with this prefix (newest wins). */
export const NOTE_PET = 'cozmc:pet:v1:'

/** Scores posted free (0-ALGO notes) before paid posting existed still count. */
export const FREE_SCORES_BEFORE_ROUND = 66_068_000
export const TOKEN_START_ROUND = 66_040_000

/**
 * Accounts that get a label on the Holders tab. `exclude` keeps them out of the
 * tier ranking. Add new liquidity pools / contracts here as they appear.
 */
export const KNOWN_ACCOUNTS: Record<string, { label: string; exclude?: boolean }> = {
  [BONFIRE_ADDRESS]: { label: 'Bonfire · burned', exclude: true },
  [CREATOR]: { label: 'Creator' },
  '32QPUTT3L7CXKRTLCZNM46V6FNO4BPMRECAXDR35JNRKO4SN42U2AAP56M': { label: 'Pool contract', exclude: true },
  // Pact: the Vault (app 3656084807) holds the ALGO/COZMC pool's reserves; the pool app's own account holds dust
  '7FSDP27MVWXOUT55I2GNQIEF6OFDFWFJBD3GIZQ4VJHZHXCLFOG2X3PZGM': { label: 'Pact pool', exclude: true },
  'Y27FN6OVUZH7JRMEEMWPHQDFEXM73A6BXSN7BSDR6JBA7YAZYVK7A7EBDA': { label: 'Pact pool app', exclude: true },
}
