/* Food, Fun and Energy: the same three needs as ever, as plain bars with real numbers. */
import type { Pet } from '../types'

const ROWS: { key: 'food' | 'fun' | 'energy'; label: string }[] = [{ key: 'food', label: 'Food' }, { key: 'fun', label: 'Fun' }, { key: 'energy', label: 'Energy' }]

export function CareMeters({ pet, dim }: { pet: Pet; dim?: boolean }) {
  return (
    <div className={`sl-meters${dim ? ' is-dim' : ''}`}>
      {ROWS.map(r => {
        const v = Math.round(pet[r.key])
        return (
          <div key={r.key} className={`sl-meter sl-meter--${r.key}${v < 25 ? ' is-low' : ''}`}>
            <span className="sl-meter__label" id={`sl-m-${r.key}`}>{r.label}</span>
            <span className="sl-meter__bar" role="meter" aria-labelledby={`sl-m-${r.key}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}><i style={{ width: `${v}%` }} /></span>
            <span className="sl-meter__value">{dim ? '–' : `${v}%`}</span>
          </div>
        )
      })}
    </div>
  )
}
