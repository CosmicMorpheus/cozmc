/* The Adrift scene's artwork (from the original trial): the rescue ship, the tether and our
   astronaut, plus a pixel starfield. RescueScene finds its moving parts by data-part. */
import { rescuePose, tetherPoint } from './scene'

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
  const ropeAt = `M110 128 Q${(110 + end.x) / 2} ${(128 + end.y) / 2 + 22} ${end.x} ${end.y}`
  return (
    <svg className="ad-art" viewBox="0 0 520 530" preserveAspectRatio={still ? 'xMidYMid slice' : 'xMidYMid meet'} role="img" aria-label="Astronaut tethered to a rescue ship above an emerald planet">
      <defs>
        <linearGradient id={u('suit')} x1="0" x2="1" y2="1"><stop stopColor="#fffef0" /><stop offset=".45" stopColor="#c4d3d5" /><stop offset="1" stopColor="#596e75" /></linearGradient>
        <linearGradient id={u('visor')} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#131c25" /><stop offset=".48" stopColor="#17292c" /><stop offset=".7" stopColor="#8ba69b" /><stop offset="1" stopColor="#15272e" /></linearGradient>
        <linearGradient id={u('gold')}><stop stopColor="#edcf83" /><stop offset="1" stopColor="#74603b" /></linearGradient>
        <filter id={u('shadow')}><feDropShadow dx="6" dy="12" stdDeviation="9" floodOpacity=".5" /></filter>
      </defs>
      <g className="ad-stars" aria-hidden="true">
        {STARS.map((s, i) => <rect key={i} x={s.x} y={s.y} width={s.s} height={s.s} style={still ? undefined : { animationDelay: `${s.d}s` }} />)}
      </g>
      <g className="ad-ship" aria-hidden="true">
        <path d="M25 74 L105 44 174 72 184 132 145 168 58 156 24 123Z" fill="#2b4043" stroke="#9aadb0" strokeWidth="3" />
        <path d="M33 78 L97 58 153 77 149 100 55 112Z" fill="#101d20" stroke="#759197" strokeWidth="2" />
        <path d="M46 84 L94 69 131 81" fill="none" stroke="#8dff6a" strokeWidth="3" />
        <path d="M20 85 L4 68 4 131 26 121 M164 83 L196 72 197 124 180 131" fill="#435b5f" stroke="#8da1a5" strokeWidth="2" />
        <rect x="77" y="105" width="67" height="47" rx="14" fill="#050d0d" stroke="#8dff6a" strokeWidth="3" />
        <rect data-part="hatch" x="80" y="108" width="61" height="41" rx="11" fill="#91c998" opacity=".18" />
        <path d="M110 109 V146" stroke="#c5ffd0" opacity=".5" />
        <text x="96" y="93" textAnchor="middle" fill="#d3e3d5" fontSize="8" fontFamily="monospace">COZMC / RESCUE 01</text>
        <path d="M39 133 L53 138 M153 144 L166 136" stroke="#8dff6a" strokeWidth="4" />
        <path className="ad-thruster" d="M33 139 L13 174 51 148" fill="#8dff6a" opacity=".3" />
        <circle className="ad-beacon-light" cx="105" cy="44" r="4" fill="#8dff6a" />
      </g>
      <path data-part="rope" d={ropeAt} fill="none" stroke="#b8f2a5" strokeWidth="2.4" />
      <path data-part="loose" d="M110 128 Q145 190 185 205" fill="none" stroke="#ffb020" strokeWidth="2.4" opacity="0" />
      <g data-part="actor" transform={actorAt}>
        <g filter={`url(#${u('shadow')})`} transform="rotate(-18 220 240)">
          <rect x="146" y="197" width="148" height="147" rx="28" fill="#46565e" stroke="#a6b5ba" strokeWidth="4" />
          <path d="M168 310 L158 393 Q156 414 183 418 L203 417 224 323 M233 320 L240 399 Q242 416 264 412 L282 402 271 311" fill={`url(#${u('suit')})`} stroke="#647880" strokeWidth="4" />
          <path d="M156 391 L205 401 201 428 Q167 439 150 421Z M240 397 L283 389 296 412 Q282 433 249 426Z" fill="#647780" stroke="#c0ced0" strokeWidth="3" />
          <path d="M162 214 Q137 196 116 165 L99 140 Q83 129 75 145 Q73 155 82 174 L109 219 Q127 249 160 256 M278 215 Q311 237 326 219 L354 183 Q372 177 373 193 L352 240 Q327 277 280 258" fill={`url(#${u('suit')})`} stroke="#71878f" strokeWidth="4" />
          <path d="M85 145 L109 169 M340 202 L359 215" stroke={`url(#${u('gold')})`} strokeWidth="13" />
          <rect x="159" y="213" width="121" height="121" rx="30" fill={`url(#${u('suit')})`} stroke="#82969c" strokeWidth="3" />
          <path d="M167 307 L274 307" stroke="#536b75" strokeWidth="12" />
          <rect x="184" y="242" width="73" height="48" rx="9" fill="#344a53" stroke="#d5dfda" strokeWidth="3" />
          <rect className="ad-chest" x="193" y="251" width="28" height="16" rx="3" fill="#8dff6a" />
          <circle cx="239" cy="257" r="5" fill="#ffb020" />
          <path d="M193 278H246" stroke="#8d9f9d" strokeWidth="3" />
          <circle cx="217" cy="160" r="76" fill={`url(#${u('suit')})`} stroke="#93a9ad" strokeWidth="5" />
          <rect x="140" y="145" width="12" height="40" rx="5" fill="#657d83" />
          <rect x="280" y="145" width="12" height="40" rx="5" fill="#657d83" />
          <path d="M156 154 Q161 104 219 103 Q275 105 278 156 L272 183 Q264 211 218 214 Q169 211 158 185Z" fill={`url(#${u('visor')})`} stroke={`url(#${u('gold')})`} strokeWidth="7" />
          <path d="M169 143 Q181 118 218 118" fill="none" stroke="#ecf9e8" strokeWidth="5" strokeLinecap="round" opacity=".65" />
          <path d="M168 182 Q221 164 270 185" fill="none" stroke="#8dff6a" strokeWidth="2" opacity=".5" />
          <text x="214" y="232" fontSize="9" textAnchor="middle" fill="#243c40" fontFamily="monospace">COZMC</text>
          <path d="M168 275 Q141 301 174 319" fill="none" stroke={`url(#${u('gold')})`} strokeWidth="9" />
          <circle cx="174" cy="319" r="8" fill="#536b75" />
        </g>
      </g>
      <g data-part="fx" aria-hidden="true" />
      <text data-part="readout" x="260" y="508" textAnchor="middle" fill="#b6d4ba" fontSize="12" fontFamily="monospace" letterSpacing=".7">TETHER CONNECTED</text>
    </svg>
  )
}
