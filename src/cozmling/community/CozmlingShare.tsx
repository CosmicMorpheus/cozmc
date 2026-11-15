import { useState } from 'react'
import { useShare } from '../../components/Share'
import { STAGE_NAME } from '../../companion/look'
import { signInfo } from '../domain/starprint'
import { originalLook, originalStage } from '../integrations/originalScene'
import type { AdventurerCompanion } from '../types'

export function CozmlingShare({ companion }: { companion: AdventurerCompanion }) {
  const share = useShare()
  const [showStarprint, setShowStarprint] = useState(false)
  const [showStage, setShowStage] = useState(false)

  function preview() {
    const stage = originalStage(companion)
    share({
      destination: 'discord',
      file: 'my-cozmling.png',
      text: `Meet ${companion.name}, my Cozmling!`,
      card: {
        kind: 'cozmling',
        name: companion.name,
        look: originalLook(companion),
        stage,
        ...(showStarprint ? { starprint: signInfo(companion.starprint.coreSign).name } : {}),
        ...(showStage ? { stageLabel: STAGE_NAME[stage] } : {}),
      },
    })
  }

  return (
    <details className="panel sl-share">
      <summary>Share Cozmling</summary>
      <p className="sl-fine">Make a card to post in Discord if you like. Its name and picture are always on it; add these only if you want them:</p>
      <div className="sl-share__opts">
        <label><input type="checkbox" checked={showStarprint} onChange={event => setShowStarprint(event.target.checked)} /> Include Starprint</label>
        <label><input type="checkbox" checked={showStage} onChange={event => setShowStage(event.target.checked)} /> Include growth stage label</label>
      </div>
      <p><button type="button" className="btn btn--ghost" onClick={preview}>Preview Discord card</button></p>
    </details>
  )
}
