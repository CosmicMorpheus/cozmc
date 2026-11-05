import { RescueArt } from './RescueArt'
import { adriftToday } from './storage'
import { Icon } from '../components/Pixel'

/* Adrift's cabinet on the Arcade floor: a still of the rescue and today's status in this browser. */
export function AdriftCabinet() {
  const today = adriftToday()
  const status = today === 'won' ? 'Rescued today ✓' : today === 'lost' ? 'Signal lost today' : today === 'playing' ? 'Mission in progress' : 'Today’s rescue is waiting'
  return (
    <article className="cab cab--adrift">
      <a className="cab__screen ad-thumb crt" href="#/arcade/adrift" aria-label="Play Adrift">
        <RescueArt id="adt" still />
        <span className="cab__attract" aria-hidden="true">Press start</span>
      </a>
      <div className="cab__body">
        <h2>Adrift <span className="ad-new">New</span></h2>
        <p>One word. One astronaut. One shot. A daily word rescue with 90 seconds and six misses.</p>
        <dl className="cab__stats">
          <div><dt>Today</dt><dd>{status}</dd></div>
          <div><dt>Wallet</dt><dd>Not needed</dd></div>
        </dl>
        <div className="row">
          <a className="btn btn--phos" href="#/arcade/adrift"><Icon name="play" size={10} /> {today === 'none' || today === 'playing' ? 'Play today’s rescue' : 'See today’s result'}</a>
        </div>
      </div>
    </article>
  )
}
