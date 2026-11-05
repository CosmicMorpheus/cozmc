/* The Adrift scene's artwork: the rescue ship and tether from the original trial, and the COZMC
   explorer (carved wooden skull mask, glowing blue eyes, the green infinity rune, zero-g dreadlocks,
   cloak, armour and compass strap), plus pixel stars. RescueScene finds its moving parts by data-part. */
import { rescuePose, tetherPoint, WINCH } from './scene'

// a fixed scatter of pixel stars (same every load)
const STARS = Array.from({ length: 70 }, (_, i) => {
  const h = Math.imul(i + 1, 2654435761) >>> 0
  return { x: h % 520, y: (h >>> 9) % 470, s: (h >>> 20) % 7 === 0 ? 3 : 2, d: ((h >>> 13) % 40) / 10 }
})

/** `still`: a static picture (the arcade cabinet), posed on the tether with no scene script attached. */
export function RescueArt({ id = 'ad', still = false }: { id?: string; still?: boolean }) {
  const u = (n: string) => `${id}-${n}`
  const p = rescuePose(1), end = tetherPoint(p)
  const actorAt = `translate(${p.x} ${p.y}) rotate(${p.angle}) scale(${p.scale}) translate(-220 -250)`
  const ropeAt = `M${WINCH.x} ${WINCH.y} Q${(WINCH.x + end.x) / 2} ${(WINCH.y + end.y) / 2 + 22} ${end.x} ${end.y}`
  return (
    <svg className="ad-art" viewBox="0 0 520 530" preserveAspectRatio={still ? 'xMidYMid slice' : 'xMidYMid meet'} role="img" aria-label="The COZMC explorer, tethered to a rescue ship in deep space">
      <defs>
        <linearGradient id={u('wood')} x1="0" y1="0" x2=".6" y2="1"><stop stopColor="#c9a172" /><stop offset=".55" stopColor="#8f6a42" /><stop offset="1" stopColor="#4e3520" /></linearGradient>
        <linearGradient id={u('cloak')} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#3a3631" /><stop offset=".5" stopColor="#1f1c18" /><stop offset="1" stopColor="#0e0d0b" /></linearGradient>
        <linearGradient id={u('leather')} x1="0" x2="1"><stop stopColor="#8a6a45" /><stop offset="1" stopColor="#4b3622" /></linearGradient>
        <linearGradient id={u('gold')}><stop stopColor="#edcf83" /><stop offset="1" stopColor="#74603b" /></linearGradient>
        <filter id={u('shadow')}><feDropShadow dx="6" dy="12" stdDeviation="9" floodOpacity=".55" /></filter>
        <filter id={u('glow')} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <g className="ad-stars" aria-hidden="true">
        {STARS.map((s, i) => <rect key={i} x={s.x} y={s.y} width={s.s} height={s.s} style={still ? undefined : { animationDelay: `${s.d}s` }} />)}
      </g>
      {/* the COZMC rescue freighter: plated hull, cockpit, engine vents, the gold ADRIFT airlock and the tether winch */}
      <g className="ad-ship" aria-hidden="true" transform="translate(-6 4) scale(.8)">
        <path d="M24 158 L66 100 L150 64 L252 52 L334 72 L388 112 L394 152 L362 190 L252 212 L140 206 L58 196Z" fill="#3a352d" transform="translate(0 10)" />
        <path d="M24 158 L66 100 L150 64 L252 52 L334 72 L388 112 L394 152 L362 190 L252 212 L140 206 L58 196Z" fill="#cdc2a9" stroke="#5c5444" strokeWidth="3" />
        <path d="M66 100 L104 150 L58 196 M150 64 L178 128 L140 206 M252 52 L246 120 L252 212 M334 72 L300 128 L362 190 M104 150 L178 128 L246 120 L300 128" fill="none" stroke="#8f8672" strokeWidth="2" />
        <path d="M110 92 L150 80 L160 104 L120 116Z M262 74 L310 84 L300 104 L258 98Z M196 168 L240 166 L242 190 L198 192Z M300 150 L340 146 L346 170 L306 176Z" fill="#a39a85" stroke="#7a7262" strokeWidth="1.5" />
        <path d="M30 168 L-6 214 L16 222 L64 178Z M92 186 L52 236 L76 242 L128 196Z" fill="#bfb49b" stroke="#5c5444" strokeWidth="3" />
        <path d="M-2 214 L14 220 M56 234 L74 240" stroke="#fff3c4" strokeWidth="4" />
        <ellipse cx="226" cy="98" rx="46" ry="20" fill="#5c5444" stroke="#2e2a22" strokeWidth="3" />
        <ellipse cx="226" cy="94" rx="30" ry="12" fill="#2e2a22" stroke="#8f8672" strokeWidth="2" />
        <ellipse cx="226" cy="91" rx="12" ry="5" fill="#141210" />
        <path d="M30 150 L44 122 L78 116 L92 140 L80 166 L46 170Z" fill="#2e2a22" stroke="#c9a65a" strokeWidth="2.5" />
        <path d="M44 140 L52 126 L76 122 L84 140 L76 156 L50 158Z" fill="#5cff5c" opacity=".4" />
        <path d="M52 126 L64 156 M68 122 L76 156" stroke="#2e2a22" strokeWidth="2" />
        <path d="M300 60 L344 70 L350 90 L304 82Z M350 80 L386 104 L384 124 L352 102Z" fill="#2e2a22" stroke="#5c5444" strokeWidth="2" />
        <path className="ad-vent" d="M306 66 L340 74 L344 84 L308 78Z M354 88 L380 106 L380 118 L356 100Z" fill="#8dff6a" />
        <text x="150" y="152" fill="#6b5a2e" fontSize="18" fontWeight="800" fontFamily="var(--sans), sans-serif" letterSpacing="2" transform="rotate(-6 150 152)">COZMC</text>
        <path d="M144 158 L222 150" stroke="#c9a65a" strokeWidth="2" />
        {/* the airlock: gold octagon frame, door, hazard stripes, ADRIFT label and green light strips */}
        <path d="M276 128 L300 120 L318 130 L322 160 L312 184 L288 190 L270 180 L266 150Z" fill="#2e2a22" stroke="#d4a840" strokeWidth="4" />
        <rect data-part="hatch" x="276" y="132" width="38" height="50" rx="4" fill="#8dff6a" opacity=".18" />
        <path d="M280 136 L310 136 L310 178 L280 178Z" fill="none" stroke="#8f8672" strokeWidth="2" />
        <path d="M282 170 L290 162 M290 178 L302 166 M300 178 L310 168" stroke="#f2c45c" strokeWidth="3" />
        <path className="ad-strip-light" d="M268 140 V170 M324 138 V166" stroke="#8dff6a" strokeWidth="3" />
        <rect x="272" y="104" width="44" height="13" fill="#2e2a22" stroke="#d4a840" strokeWidth="1.5" />
        <text x="294" y="114" textAnchor="middle" fill="#f1e2b8" fontSize="9" fontWeight="700" fontFamily="var(--sans), sans-serif" letterSpacing="1">ADRIFT</text>
        {/* the tether winch: a drum wound with green line */}
        <rect x="324" y="150" width="34" height="34" rx="4" fill="#3a352d" stroke="#d4a840" strokeWidth="2.5" />
        <g className="ad-winch"><ellipse cx="341" cy="167" rx="12" ry="14" fill="#2c6b1f" stroke="#8dff6a" strokeWidth="2" /><path d="M331 160 H351 M331 166 H351 M331 172 H351" stroke="#b8f2a5" strokeWidth="2" /></g>
        <circle className="ad-beacon-light" cx="252" cy="54" r="4" fill="#8dff6a" />
        <g className="ad-running" fill="#8dff6a"><rect x="120" y="186" width="10" height="3" /><rect x="200" y="196" width="10" height="3" /><rect x="372" y="150" width="3" height="10" /><rect x="88" y="104" width="10" height="3" /></g>
        <path className="ad-thruster" d="M392 118 L430 108 L432 128 L394 138Z" fill="#8dff6a" opacity=".35" />
      </g>
      <path data-part="rope" d={ropeAt} fill="none" stroke="#b8f2a5" strokeWidth="2.4" />
      <path data-part="loose" d={`M${WINCH.x} ${WINCH.y} Q${WINCH.x + 30} ${WINCH.y + 50} ${WINCH.x + 50} ${WINCH.y + 70}`} fill="none" stroke="#ffb020" strokeWidth="2.4" opacity="0" />
      <g data-part="actor" transform={actorAt}>
        <g filter={`url(#${u('shadow')})`} transform="rotate(-18 220 240)">
          {/* the hair: a dark mass with dreadlocks floating free in zero gravity */}
          <path d="M150 150 C140 90 190 70 217 72 C262 70 300 96 288 160 C296 190 280 230 262 236 L172 236 C150 226 142 190 150 150Z" fill="#33231a" />
          <g className="ad-dreads" fill="none" strokeLinecap="round">
            {[[12, '#4a3320'], [4, '#8a6440']].map(([w, c], k) => (
              <g key={k} stroke={c as string} strokeWidth={w as number} strokeDasharray={k ? '3 6' : undefined}>
                {['M180 108 C160 90 170 70 150 52 C134 38 140 22 126 12', 'M200 96 C192 74 206 58 196 38 C190 26 198 14 192 4', 'M228 92 C236 72 226 56 238 38 C246 26 240 14 250 6', 'M256 102 C276 88 284 70 302 62 C318 56 324 44 338 40', 'M276 126 C298 120 312 104 332 104 C346 104 352 96 364 92', 'M160 128 C140 122 126 108 108 110 C96 112 88 106 78 100', 'M156 160 C132 164 122 180 104 186 C92 190 86 200 78 208', 'M280 160 C302 166 312 182 330 190 C342 196 346 206 356 214', 'M162 196 C146 214 150 236 136 252 C128 262 132 276 124 288', 'M272 194 C288 214 286 236 300 252 C308 262 306 276 314 288', 'M170 100 C146 96 140 76 120 70', 'M266 112 C292 104 300 86 322 82'].map(d => <path key={d} d={d} />)}
              </g>
            ))}
            <g fill="#8fae38">{[[150, 52], [196, 38], [238, 38], [302, 62], [332, 104], [108, 110], [104, 186], [330, 190], [136, 252], [300, 252], [120, 70], [322, 82]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" />)}</g>
          </g>
          {/* legs and boots */}
          <path d="M184 326 L172 398 Q170 416 192 419 L210 417 222 334 M232 334 L240 402 Q242 419 262 415 L280 405 270 326" fill="#1d1b17" stroke="#4a463e" strokeWidth="4" />
          <path d="M160 392 L208 402 204 428 Q170 438 154 421Z M238 398 L282 388 296 412 Q282 432 250 426Z" fill={`url(#${u('leather')})`} stroke="#a3875c" strokeWidth="3" />
          {/* arms: one reaching up for the ship, one out for balance; leather-wrapped forearms, gloves */}
          <path d="M164 258 Q138 226 118 190 L102 158 Q88 142 78 156 Q74 166 84 182 L110 226 Q128 254 162 268 M272 258 Q306 270 326 248 L352 218 Q368 206 374 222 L356 256 Q330 288 276 276" fill={`url(#${u('cloak')})`} stroke="#4a463e" strokeWidth="4" />
          <path d="M98 176 L118 166 M106 194 L126 184 M330 240 L346 254 M342 228 L358 240" stroke={`url(#${u('leather')})`} strokeWidth="9" />
          <circle cx="86" cy="152" r="14" fill={`url(#${u('leather')})`} stroke="#a3875c" strokeWidth="3" />
          <circle cx="370" cy="212" r="13" fill={`url(#${u('leather')})`} stroke="#a3875c" strokeWidth="3" />
          <path d="M108 200 L114 188 110 178" fill="none" stroke="#8dff6a" strokeWidth="2.5" filter={`url(#${u('glow')})`} />
          {/* cloak and armour */}
          <path d="M156 246 Q217 232 280 246 L290 330 Q217 352 150 330Z" fill={`url(#${u('cloak')})`} stroke="#4a463e" strokeWidth="4" />
          <path d="M150 248 Q166 236 190 246 L184 276 Q162 280 148 266Z M244 246 Q268 236 286 250 L288 268 Q272 280 252 276Z" fill="#3b3833" stroke="#7a756b" strokeWidth="3" />
          <path d="M170 300 Q188 312 206 300 M232 306 Q252 316 270 302" fill="none" stroke="#2c2924" strokeWidth="3" />
          <path d="M262 286 L270 298 266 312" fill="none" stroke="#8dff6a" strokeWidth="2.5" filter={`url(#${u('glow')})`} />
          {/* the leather strap and its compass medallion */}
          <path d="M262 246 L176 332" stroke={`url(#${u('leather')})`} strokeWidth="16" />
          <path d="M262 246 L176 332" stroke="#c9b07a" strokeWidth="1.5" strokeDasharray="4 5" />
          <circle cx="212" cy="296" r="12" fill="#3a2c1c" stroke="#d4b97c" strokeWidth="3" />
          <path d="M212 286 L215 293 222 296 215 299 212 306 209 299 202 296 209 293Z" fill="#d4b97c" />
          <path d="M152 324 L286 324" stroke="#2a2018" strokeWidth="10" />
          {/* the scarf wrapped round the neck */}
          <path d="M162 232 Q217 266 272 232 L282 258 Q217 296 152 258Z" fill="#26231e" stroke="#4a463e" strokeWidth="3" />
          <path d="M172 250 Q217 272 262 250 M168 262 Q217 286 266 262" fill="none" stroke="#3d3934" strokeWidth="3" />
          {/* the carved wooden skull mask */}
          <path d="M217 90 C259 90 283 117 282 151 C281 170 274 182 268 194 L258 214 C250 230 235 240 217 242 C199 240 184 230 176 214 L166 194 C160 182 153 170 152 151 C151 117 175 90 217 90Z" fill={`url(#${u('wood')})`} stroke="#2e2010" strokeWidth="4" />
          <path d="M226 92 C262 96 284 122 282 152 C281 170 274 182 268 194 L258 214 C250 230 236 240 220 242 C238 220 246 188 244 150 C242 120 236 102 226 92Z" fill="#2a1a0c" opacity=".38" />
          <path d="M168 186 Q182 182 196 196 Q186 210 176 212Z M266 186 Q252 182 238 196 Q248 210 258 212Z" fill="#2a1a0c" opacity=".45" />
          <path d="M186 110 Q176 138 182 156 M250 106 Q262 130 256 150 M196 226 Q217 234 238 226 M200 100 Q217 96 234 100" fill="none" stroke="#5e4329" strokeWidth="2" opacity=".8" />
          <path d="M166 158 Q186 140 212 160 M268 158 Q248 140 222 160" fill="none" stroke="#2e2010" strokeWidth="7" strokeLinecap="round" />
          <path d="M172 162 Q190 150 210 166 Q200 182 184 180 Q172 176 172 162Z M262 162 Q244 150 224 166 Q234 182 250 180 Q262 176 262 162Z" fill="#0d0805" />
          <g className="ad-eyes" filter={`url(#${u('glow')})`}><circle cx="192" cy="167" r="5.5" fill="#bfe3ff" /><circle cx="242" cy="167" r="5.5" fill="#bfe3ff" /><circle cx="192" cy="167" r="9" fill="#3d8bff" opacity=".55" /><circle cx="242" cy="167" r="9" fill="#3d8bff" opacity=".55" /></g>
          <path d="M211 184 Q207 196 214 202 L217 196 L220 202 Q227 196 223 184 Q217 188 211 184Z" fill="#140c06" />
          <path d="M194 210 L240 210 L236 224 Q217 230 198 224Z" fill="#d9bf92" stroke="#3a2a18" strokeWidth="2.5" />
          <path d="M202 211 V224 M210 212 V226 M218 212 V227 M226 212 V226 M233 211 V224" stroke="#3a2a18" strokeWidth="1.8" />
          <g className="ad-rune" fill="none" stroke="#8dff6a" strokeLinecap="round" filter={`url(#${u('glow')})`}>
            <path d="M216 128 C216 120 226 120 230 128 C234 136 244 136 244 128 C244 120 234 120 230 128 C226 136 216 136 216 128Z" strokeWidth="3.5" />
            <path d="M236 98 L232 116 M232 140 L238 150 M244 176 L240 196 M166 180 L174 194 170 206" strokeWidth="2.4" />
          </g>
          <g fill="none" strokeLinecap="round">
            <path d="M174 214 C164 238 176 258 164 282 C158 294 166 304 160 316" stroke="#4a3320" strokeWidth="10" />
            <path d="M262 214 C272 238 260 258 272 282 C278 294 270 304 276 316" stroke="#4a3320" strokeWidth="10" />
            <path d="M174 214 C164 238 176 258 164 282 C158 294 166 304 160 316 M262 214 C272 238 260 258 272 282 C278 294 270 304 276 316" stroke="#8a6440" strokeWidth="3.5" strokeDasharray="3 6" />
          </g>
          {/* the harness clip the rescue tether hooks onto */}
          <path d="M184 288 Q160 304 174 319" fill="none" stroke={`url(#${u('gold')})`} strokeWidth="7" />
          <circle cx="174" cy="319" r="8" fill="#3b3833" stroke="#d4b97c" strokeWidth="3" />
          <circle className="ad-chest" cx="174" cy="319" r="2.5" fill="#8dff6a" />
        </g>
      </g>
      <g data-part="fx" aria-hidden="true" />
      <text data-part="readout" x="260" y="508" textAnchor="middle" fill="#b6d4ba" fontSize="12" fontFamily="monospace" letterSpacing=".7">TETHER CONNECTED</text>
    </svg>
  )
}
