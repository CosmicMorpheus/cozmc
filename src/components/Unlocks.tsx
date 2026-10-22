import { useEffect, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { achById, onUnlock, walletBadges, type Ach } from '../lib/profile'
import { useChain } from '../lib/data'
import { useMe } from './Wallet'
import { Medal } from './Pixel'
import { sfx } from '../arcade/sfx'

/* Achievement pop-ups, one at a time, bottom-left. Also awards the
   wallet-backed badges whenever the chain data says they're earned. */
export function Unlocks() {
  const [queue, setQueue] = useState<Ach[]>([])
  const cur = queue[0]
  const { activeAddress } = useWallet()
  const { holding } = useMe()
  const { burns, scores } = useChain()

  useEffect(() => onUnlock(id => { const a = achById(id); if (a) setQueue(q => [...q, a]) }), [])

  useEffect(() => {
    if (!activeAddress) return
    walletBadges({
      balance: holding,
      burned: !!burns.data?.some(b => b.sender === activeAddress),
      posted: !!scores.data?.some(s => s.player === activeAddress),
    })
  }, [activeAddress, holding, burns.data, scores.data])

  useEffect(() => {
    if (!cur) return
    ;[784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => sfx.tone(f, 0.09, 'square', 0.035), i * 75))
    const t = setTimeout(() => setQueue(q => q.slice(1)), 3600)
    return () => clearTimeout(t)
  }, [cur])

  if (!cur) return null
  return (
    <div className="unlock" role="status" key={cur.id}>
      <Medal kind={cur.kind} size={44} />
      <div>
        <p className="unlock__kicker">Badge unlocked</p>
        <p className="unlock__name">{cur.name}</p>
        <p className="unlock__desc">{cur.desc}</p>
      </div>
      <a className="unlock__link" href="#/arcade/card" onClick={() => setQueue([])}>Your card</a>
    </div>
  )
}
