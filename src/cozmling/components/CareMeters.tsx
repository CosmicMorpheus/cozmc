/* Food, Fun and Energy: the same three needs as ever, as plain bars with real numbers. */
import { ART } from '../../companion/room'
import { PixelArt } from '../../components/Pixel'
import type { Pet } from '../types'

const ROWS: { key: 'food' | 'fun' | 'energy'; label: string; icon: string }[] = [{ key: 'food', label: 'Food', icon: 'cheese' }, { key: 'fun', label: 'Fun', icon: 'ball' }, { key: 'energy', label: 'Energy', icon: 'z' }]

export function CareMeters({ pet, dim }: { pet: Pet; dim?: boolean }) {
  return (
    <div className={`sl-meters${dim ? ' is-dim' : ''}`}>
      {ROWS.map(r => {
        const v = Math.round(pet[r.key])
        return (
          <div key={r.key} className={`sl-meter sl-meter--${r.key}${v < 25 && !dim ? ' is-low' : ''}`}>
            <span className="sl-meter__icon" aria-hidden="true"><PixelArt rows={ART[r.icon].rows} palette={ART[r.icon].pal} size={16} /></span>
            <span className="sl-meter__label" id={`sl-m-${r.key}`}>{r.label}</span>
            <span className="sl-meter__bar" role="meter" aria-labelledby={`sl-m-${r.key}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-valuetext={dim ? 'not hatched yet' : `${v}%`}><i style={{ width: `${v}%` }} /></span>
            <span className="sl-meter__value">{dim ? '–' : `${v}%`}</span>
          </div>
        )
      })}
    </div>
  )
}
