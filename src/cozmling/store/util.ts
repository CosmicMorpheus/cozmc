/* Checksums and ids, with fallbacks for pages that aren't served over https (where the browser
   withholds crypto.subtle and randomUUID). Checksums here spot changes; they aren't security. */
const hex = (b: Uint8Array) => [...b].map(x => x.toString(16).padStart(2, '0')).join('')

export async function checksum(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const subtle = (globalThis.crypto as Partial<Crypto> | undefined)?.subtle
  if (subtle) return `sha256:${hex(new Uint8Array(await subtle.digest('SHA-256', bytes)))}`
  let a = 0x811c9dc5, b = 0x01000193            // two rounds of FNV-1a with different starts
  for (const x of bytes) { a = Math.imul(a ^ x, 0x01000193) >>> 0; b = Math.imul(b ^ x, 0x85ebca6b) >>> 0 }
  return `fnv:${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}:${bytes.length}`
}

export function newId(): string {
  const c = globalThis.crypto as Partial<Crypto> | undefined
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
  const h = hex(b)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
