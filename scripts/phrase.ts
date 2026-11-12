/* ============================================================
   READING THE PRIZE WALLET'S RECOVERY PHRASE (used by scripts/daily-payout.ts)

   Algorand's own phrase has 25 words. Many wallets (newer Pera accounts, Exodus, Ledger and
   others) use a 24-word phrase instead (BIP-39). Both are read here, and every route to the key
   ends in the same safety check: the account it gives must be exactly the prize wallet
   (DAILY_PRIZES.payer). A phrase that gives any other account is refused and nothing is sent.

   For 24 words, these are tried in turn, over accounts 0 to 9 and key indexes 0 to 9:
     1. a 25-word phrase with its last (check) word left out
     2. ARC-52, "xHD", BIP32-Ed25519 (the Algorand Foundation's scheme; path m/44'/283'/account'/0/index),
        with both published variants, Peikert (the default) and Khovratovich
     3. SLIP-10 Ed25519 with every step hardened (Ledger and similar), on m/44'/283'/account'/0'/index'
   Which one matched is reported (never the phrase, never a key).

   Nothing here prints, returns or logs the words. Error text says only how many words were found.
   The ARC-52 maths follows the Algorand Foundation's reference code (@algorandfoundation/xhd-wallet-api);
   tests/phrase.test.ts checks it against that library's own published test vector.
   ============================================================ */
import { createHash, createHmac, createPublicKey, pbkdf2Sync, verify as nodeVerify } from 'node:crypto'
import algosdk from 'algosdk'

export interface Signer {
  addr: string
  /** What was recognised, for the log. Empty for a plain 25-word phrase. */
  how: string
  /** The signed transaction, ready to send. */
  sign(txn: algosdk.Transaction): Promise<Uint8Array>
}

/** Tidy a pasted recovery phrase: line breaks, extra spaces, commas, numbering, capitals or quotes around it are all fine. */
export const tidyPhrase = (s: string) =>
  s.replace(/["'“”‘’`,;:]/g, ' ').replace(/(^|\s)\d+[.)]\s/g, ' ').toLowerCase().split(/\s+/).filter(Boolean).join(' ')

const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-4)}`

/* ---------------- Algorand's own 25-word phrase ---------------- */
function nativeSigner(mnemonic: string, how = ''): Signer {
  const a = algosdk.mnemonicToSecretKey(mnemonic)
  return { addr: a.addr.toString(), how, sign: async t => t.signTxn(a.sk) }
}
const fromSeed32 = (seed: Uint8Array, how: string) => nativeSigner(algosdk.mnemonicFromSeed(seed), how)

/* The standard word list, read back out of algosdk itself so it can never differ from the one it checks with.
   algosdk packs a 32-byte seed into 11-bit words from the low bits up, so seed bytes (k & 255, k >> 8) make word k. */
let LIST: string[] | null = null
const wordList = () => LIST ??= Array.from({ length: 2048 }, (_, k) => {
  const seed = new Uint8Array(32); seed[0] = k & 255; seed[1] = k >> 8
  return algosdk.mnemonicFromSeed(seed).split(' ')[0]
})

/** The key inside 24 words of the 25-word kind (the 25th word is only a check on the other 24), or null if these 24 are not that kind. */
export function seedFromTwentyFour(phrase: string): Uint8Array | null {
  const list = wordList(), idx = phrase.split(' ').map(w => list.indexOf(w))
  if (idx.length !== 24 || idx.includes(-1)) return null
  let bits = 0n
  idx.forEach((v, j) => { bits |= BigInt(v) << BigInt(11 * j) })       // low bits first, as algosdk does
  if (bits >> 256n !== 0n) return null                                 // the 8 spare bits are zero in this kind; a BIP-39 phrase carries its own check there
  const seed = new Uint8Array(32)
  for (let k = 0; k < 32; k++) seed[k] = Number((bits >> BigInt(8 * k)) & 0xffn)
  return seed
}

/* ---------------- 24-word (BIP-39) phrases ---------------- */
export const bip39Seed = (phrase: string) => pbkdf2Sync(Buffer.from(phrase.normalize('NFKD')), Buffer.from('mnemonic'), 2048, 64, 'sha512')
const H = (n: number) => (0x80000000 + n) >>> 0
const u32 = (n: number, little: boolean) => { const b = Buffer.alloc(4); little ? b.writeUInt32LE(n) : b.writeUInt32BE(n); return b }

/** SLIP-10 for Ed25519: only hardened steps exist. */
export function slip10(seed: Buffer, path: number[]): Uint8Array {
  let I = createHmac('sha512', 'ed25519 seed').update(seed).digest()
  for (const i of path) I = createHmac('sha512', I.subarray(32)).update(Buffer.concat([Buffer.from([0]), I.subarray(0, 32), u32(H(i), false)])).digest()
  return new Uint8Array(I.subarray(0, 32))
}

/* BIP32-Ed25519 (ARC-52). Little-endian numbers, curve work by @noble/curves. */
type Ed = typeof import('@noble/curves/ed25519.js').ed25519
let ED: Ed | null = null
export const curve = async () => ED ??= (await import('@noble/curves/ed25519.js')).ed25519
const le = (b: Uint8Array) => { let v = 0n; for (let i = b.length - 1; i >= 0; i--) v = (v << 8n) | BigInt(b[i]); return v }
const toLe = (v: bigint, n: number) => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) { b[i] = Number(v & 0xffn); v >>= 8n } return b }
const sha512 = (...p: Uint8Array[]) => createHash('sha512').update(Buffer.concat(p)).digest()
const hmac512 = (key: Uint8Array, data: Uint8Array) => createHmac('sha512', key).update(data).digest()

export interface Ext { kL: Uint8Array; kR: Uint8Array; c: Uint8Array }

export function rootKey(seed64: Uint8Array): Ext {
  let k = sha512(seed64), kL = k.subarray(0, 32), kR = k.subarray(32, 64)
  while (kL[31] & 0b00100000) { k = hmac512(kL, kR); kL = k.subarray(0, 32); kR = k.subarray(32, 64) }
  kL = Buffer.from(kL); kR = Buffer.from(kR)
  kL[0] &= 0b11111000; kL[31] &= 0b01111111; kL[31] |= 0b01000000
  return { kL, kR, c: createHash('sha256').update(Buffer.concat([Buffer.from([1]), seed64])).digest() }
}

/** Zero the top g bits of a 32-byte little-endian number. */
function dropTop(z: Uint8Array, g: number): Uint8Array {
  const t = Buffer.from(z); let left = g
  for (let i = t.length - 1; i >= 0 && left > 0; i--) { if (left >= 8) { t[i] = 0; left -= 8 } else { t[i] &= 0xff >> left; break } }
  return t
}

const TWO_255 = 1n << 255n, TWO_256 = 1n << 256n
function child(ed: Ed, k: Ext, index: number, g: number): Ext {
  const L = ed.Point.Fn.ORDER, kLn = le(k.kL)
  let zData: Buffer, ccData: Buffer
  if (index < 0x80000000) {
    const A = ed.Point.BASE.multiply(kLn % L).toBytes()
    zData = Buffer.concat([Buffer.from([2]), A, u32(index, true)]); ccData = Buffer.concat([Buffer.from([3]), A, u32(index, true)])
  } else {
    zData = Buffer.concat([Buffer.from([0]), k.kL, k.kR, u32(index, true)]); ccData = Buffer.concat([Buffer.from([1]), k.kL, k.kR, u32(index, true)])
  }
  const z = hmac512(k.c, zData), c = hmac512(k.c, ccData).subarray(32, 64)
  const left = kLn + 8n * le(dropTop(z.subarray(0, 32), g))
  if (left >= TWO_255) throw new Error('out of range')                 // the reference code refuses this too
  return { kL: toLe(left, 32), kR: toLe((le(k.kR) + le(z.subarray(32, 64))) % TWO_256, 32), c: new Uint8Array(c) }
}

export function derive(ed: Ed, root: Ext, path: number[], g: number) { return path.reduce((k, i) => child(ed, k, i, g), root) }

/** An Ed25519 signature made with an extended key (kL, kR), which has no 32-byte seed behind it. */
export function signExtended(ed: Ed, k: Ext, msg: Uint8Array): Uint8Array {
  const L = ed.Point.Fn.ORDER, kLn = le(k.kL)
  const A = ed.Point.BASE.multiply(kLn % L).toBytes()
  const r = le(sha512(k.kR, msg)) % L
  const R = ed.Point.BASE.multiply(r).toBytes()
  const h = le(sha512(R, A, msg)) % L
  const S = (r + h * kLn) % L
  return Buffer.concat([R, toLe(S, 32)])
}

const SPKI = Buffer.from('302a300506032b6570032100', 'hex')
const verifies = (msg: Uint8Array, sig: Uint8Array, pub: Uint8Array) => nodeVerify(null, msg, createPublicKey({ key: Buffer.concat([SPKI, pub]), format: 'der', type: 'spki' }), sig)

function extendedSigner(ed: Ed, k: Ext, how: string): Signer {
  const pub = ed.Point.BASE.multiply(le(k.kL) % ed.Point.Fn.ORDER).toBytes(), addr = algosdk.encodeAddress(pub)
  return {
    addr, how,
    async sign(txn) {
      const msg = txn.bytesToSign(), sig = signExtended(ed, k, msg)
      if (!verifies(msg, sig, pub)) throw new Error('the signature made with this key did not check out. Nothing was sent.')   // never send what the network would refuse
      return txn.attachSignature(addr, sig)
    },
  }
}

const TRY = 10        // accounts and key indexes 0 to 9

/** Find the route from these 24 words to `target`, or null. Cheap, and it only ever reads. */
export async function fromTwentyFour(phrase: string, target: string): Promise<Signer | null> {
  const seed = seedFromTwentyFour(phrase)
  if (seed) { const s = fromSeed32(seed, 'a 25-word phrase that was missing its last word'); if (s.addr === target) return s }
  const ed = await curve(), bip = bip39Seed(phrase), root = rootKey(bip)
  for (const [g, name] of [[9, 'Peikert'], [32, 'Khovratovich']] as const)
    for (let a = 0; a < TRY; a++) {
      let node: Ext
      try { node = derive(ed, root, [H(44), H(283), H(a), 0], g) } catch { continue }
      for (let i = 0; i < TRY; i++) {
        let k: Ext
        try { k = child(ed, node, i, g) } catch { continue }
        const s = extendedSigner(ed, k, `ARC-52 (${name}), account ${a}, key ${i}`)
        if (s.addr === target) return s
      }
    }
  const b = bip
  for (let a = 0; a < TRY; a++) for (let i = 0; i < TRY; i++) {
    const s = fromSeed32(slip10(b, [44, 283, a, 0, i]), `SLIP-10 Ed25519, account ${a}, key ${i}`)
    if (s.addr === target) return s
  }
  return null
}

/** An error whose text is safe to print: it never contains a word of the phrase. */
class Unreadable extends Error {}

/**
 * Read a pasted phrase into something that can sign. A 25-word phrase gives whatever account it belongs to (the caller
 * checks that it is the prize wallet); a 24-word phrase is only accepted if it gives `target`.
 * Throws an Error whose text is safe to print. Anything unexpected is replaced by a plain message,
 * so no library error text can ever carry part of the phrase into a log.
 */
export async function readPhrase(raw: string, target: string): Promise<Signer> {
  try { return await read(raw, target) }
  catch (e) {
    if (e instanceof Unreadable) throw e
    throw new Unreadable('PRIZE_WALLET_MNEMONIC could not be read because of an unexpected problem. Nothing was sent.')
  }
}

async function read(raw: string, target: string): Promise<Signer> {
  const phrase = tidyPhrase(raw), count = phrase ? phrase.split(' ').length : 0
  if (count === 25) {
    try { return nativeSigner(phrase) }
    catch (e: any) {
      throw new Unreadable(`PRIZE_WALLET_MNEMONIC could not be read: all 25 words are there, but ${/wordlist/i.test(String(e?.message))
        ? 'at least one is not in the standard word list (a typo?)'
        : 'the check at the end fails (a word is wrong, missing or out of order)'}. Nothing was sent.`)
    }
  }
  if (count === 24) {
    const list = wordList(), odd = phrase.split(' ').filter(w => !list.includes(w)).length
    if (odd) throw new Unreadable(`PRIZE_WALLET_MNEMONIC could not be read: ${odd} of the 24 words ${odd === 1 ? 'is' : 'are'} not in the standard word list (a typo?). Nothing was sent.`)
    const s = await fromTwentyFour(phrase, target)
    if (s) return s
    throw new Unreadable(`PRIZE_WALLET_MNEMONIC could not be read: the 24 words are valid, but none of the usual wallet methods turns them into the prize wallet ${short(target)}. They may belong to another wallet, or be in a different order. Nothing was sent.`)
  }
  throw new Unreadable(`PRIZE_WALLET_MNEMONIC could not be read: ${count} words were found and it needs 25 (or 24 for a newer wallet type). Nothing was sent.`)
}
