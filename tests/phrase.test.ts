/* Reading the prize wallet's recovery phrase, without touching a network: `npm test`.
   Every phrase in this file is a made-up or public test phrase. None of them is, or ever was, a real wallet. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicKey, randomBytes, verify } from 'node:crypto'
import algosdk from 'algosdk'
import { bip39Seed, curve, fromTwentyFour, readPhrase, seedFromTwentyFour, signExtended, slip10, tidyPhrase, rootKey, derive } from '../scripts/phrase'

/** The Algorand Foundation's published test phrase for ARC-52 (xhd-wallet-api): m/44'/283'/0'/0/0 must give this address. */
const OFFICIAL = 'salon zoo engage submit smile frost later decide wing sight chaos renew lizard rely canal coral scene hobby scare step bus leaf tobacco slice'
const OFFICIAL_ADDR = 'ML7IGK322ECUJPUDG6THAQ26KBSK4STG4555PCIJOZNUNNLWU3Z3ZFXITA'      // the Khovratovich variant; this key signed a real TestNet payment
/** A transaction from that library's tests, already prefixed with "TX". */
const OFFICIAL_TX = Buffer.from('VFiJo2FtdM0D6KNmZWXNA+iiZnbOAkeSd6NnZW6sdGVzdG5ldC12MS4womdoxCBIY7UYpLPITsgQ8i1PEIHLD3HwWaesIN7GL39w5Qk6IqJsds4CR5Zfo3JjdsQgYv6DK3rRBUS+gzemcENeUGSuSmbne9eJCXZbRrV2pvOjc25kxCBi/oMretEFRL6DN6ZwQ15QZK5KZud714kJdltGtXam86R0eXBlo3BheQ==', 'base64')
const ABANDON_ART = Array(23).fill('abandon').concat('art').join(' ')                // the standard BIP-39 24-word test phrase
const SPKI = Buffer.from('302a300506032b6570032100', 'hex')
const checks = (msg: Uint8Array, sig: Uint8Array, pub: Uint8Array) => verify(null, msg, createPublicKey({ key: Buffer.concat([SPKI, pub]), format: 'der', type: 'spki' }), sig)
const words = (n: number) => algosdk.mnemonicFromSeed(randomBytes(32)).split(' ').slice(0, n).join(' ')

test('BIP-39 seed matches the standard test vector', () => {
  assert.equal(bip39Seed('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about').toString('hex'),
    '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4')
})

test('SLIP-10 Ed25519 matches the official test vector 1', () => {
  const seed = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex')
  assert.equal(Buffer.from(slip10(seed, [0])).toString('hex'), '68e0fe46dfb67e368c75379acec591dad19df3cde26e63b93a8e704f1dade7a3')
  assert.equal(Buffer.from(slip10(seed, [0, 1, 2, 2, 1000000000])).toString('hex'), '8f94d394a8e8fd6b1bc2f3f49f5c47e385281d5c17e65324b0f62483e37e8793')
})

test('ARC-52 gives the official address, and signs what the network will accept', async () => {
  const s = await fromTwentyFour(OFFICIAL, OFFICIAL_ADDR)
  assert.ok(s, 'the official phrase must be recognised')
  assert.equal(s!.addr, OFFICIAL_ADDR)
  assert.match(s!.how, /ARC-52 \(Khovratovich\), account 0, key 0/)
  const ed = await curve(), k = derive(ed, rootKey(new Uint8Array(bip39Seed(OFFICIAL))), [0x80000000 + 44, 0x80000000 + 283, 0x80000000, 0, 0], 32)
  const sig = signExtended(ed, k, OFFICIAL_TX)
  assert.ok(checks(OFFICIAL_TX, sig, algosdk.decodeAddress(OFFICIAL_ADDR).publicKey), 'the signature must verify with an independent Ed25519 check')
})

test('a signed Algorand transaction from an ARC-52 key is valid and carries no rekey marker', async () => {
  const s = (await fromTwentyFour(OFFICIAL, OFFICIAL_ADDR))!
  const sp = { fee: 1000n, flatFee: true, firstValid: 1000n, lastValid: 2000n, genesisHash: new Uint8Array(32).fill(7), genesisID: 'testnet-v1.0', minFee: 1000n } as algosdk.SuggestedParams
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ sender: OFFICIAL_ADDR, receiver: algosdk.generateAccount().addr, amount: 5, assetIndex: 3739851986, suggestedParams: sp })
  const st = algosdk.decodeSignedTransaction(await s.sign(txn))
  assert.equal(st.sgnr, undefined)
  assert.ok(checks(st.txn.bytesToSign(), st.sig!, algosdk.decodeAddress(OFFICIAL_ADDR).publicKey))
})

test('a 24-word phrase is only accepted if it gives exactly the prize wallet', async () => {
  const ed = await curve(), k = derive(ed, rootKey(new Uint8Array(bip39Seed(ABANDON_ART))), [0x80000000 + 44, 0x80000000 + 283, 0x80000000 + 2, 0, 3], 9)
  const mine = algosdk.encodeAddress(ed.Point.BASE.multiply(BigInt('0x' + Buffer.from(k.kL).reverse().toString('hex')) % ed.Point.Fn.ORDER).toBytes())
  assert.equal((await readPhrase(ABANDON_ART, mine)).addr, mine)
  await assert.rejects(readPhrase(ABANDON_ART, algosdk.generateAccount().addr.toString()), /none of the usual wallet methods/)
})

test('SLIP-10 (Ledger-style) accounts are found', async () => {
  const addr = algosdk.mnemonicToSecretKey(algosdk.mnemonicFromSeed(slip10(bip39Seed(ABANDON_ART), [44, 283, 1, 0, 6]))).addr.toString()
  const s = await readPhrase(ABANDON_ART, addr)
  assert.equal(s.addr, addr); assert.match(s.how, /SLIP-10 Ed25519, account 1, key 6/)
})

test('24 words of the 25-word kind (last word left out) are completed, and only then', async () => {
  for (let i = 0; i < 20; i++) {
    const seed = new Uint8Array(randomBytes(32)), full = algosdk.mnemonicFromSeed(seed), target = algosdk.mnemonicToSecretKey(full).addr.toString()
    const cut = full.split(' ').slice(0, 24).join(' ')
    assert.deepEqual(seedFromTwentyFour(cut), seed)
    const s = await readPhrase(cut, target)
    assert.equal(s.addr, target); assert.match(s.how, /missing its last word/)
  }
  assert.equal(seedFromTwentyFour(ABANDON_ART), null, 'a BIP-39 phrase has its own check where the spare zero bits would be')
})

test('a 25-word phrase reads however it was pasted', async () => {
  const mn = algosdk.mnemonicFromSeed(randomBytes(32)), addr = algosdk.mnemonicToSecretKey(mn).addr.toString(), w = mn.split(' ')
  const forms = [mn, w.join('\n') + '\n', '  ' + w.join('   ') + '  ', `"${mn}"`, mn.toUpperCase(), w.map((x, i) => `${i + 1}. ${x}`).join('\n'), w.join(', ')]
  for (const f of forms) assert.equal((await readPhrase(f, 'ignored')).addr, addr)
  assert.equal(tidyPhrase(''), '')
})

test('a phrase that cannot be read says why, and never repeats a word of it', async () => {
  const mn = algosdk.mnemonicFromSeed(randomBytes(32)), w = mn.split(' ')
  const cases: [string, RegExp][] = [
    ['', /0 words were found/], [w.slice(0, 12).join(' '), /12 words were found/], [mn + ' abandon', /26 words were found/],
    [[...w.slice(0, 5), 'zzzzzz', ...w.slice(6)].join(' '), /not in the standard word list/],
    [[w[1], w[0], ...w.slice(2)].join(' '), /check at the end fails/],
    [[...w.slice(0, 5), 'zzzzzz', ...w.slice(6, 24)].join(' '), /1 of the 24 words is not in the standard word list/],
  ]
  for (const [bad, expect] of cases) {
    await assert.rejects(readPhrase(bad, 'KVKJDMESHWEVEVG2YWIL3DGP7KRKFR2FML4RFRSHYDJ5CE62PV4KOEFZYY'), (e: Error) => {
      assert.match(e.message, expect)
      for (const word of new Set(bad.split(' ').filter(x => x.length > 3))) assert.ok(!e.message.includes(word), `the message must not contain "${word}"`)
      return true
    })
  }
  await assert.rejects(readPhrase(words(24), 'KVKJDMESHWEVEVG2YWIL3DGP7KRKFR2FML4RFRSHYDJ5CE62PV4KOEFZYY'), /none of the usual wallet methods/)
})
