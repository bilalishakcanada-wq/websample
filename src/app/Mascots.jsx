/* Poso.ba illustrations: flat, friendly people doing everyday jobs, drawn in our palette
   (navy / gold / mint / cream) with no outlines. Every scene is built from the same `Person`
   so the whole app feels like one family. All scenes share the 300×300 viewBox. */

const NAVY = '#0d2a52'
const INK = '#061530'
const BLUE = '#1d4f8f'
const GOLD = '#f5b400'
const GOLD_DARK = '#d99a00'
const GOLD_LIGHT = '#ffd86b'
const MINT = '#8fd3b6'
const MINT_DARK = '#4fae88'
const CREAM = '#fff4d6'
const MIST = '#e8f4ee'
const SKY = '#e3ecf7'
const WHITE = '#ffffff'
const SKIN = { light: '#f3c6a5', tan: '#d9a066', deep: '#8d5524' }
const HAIR = { dark: '#2b1d14', brown: '#6b4423', black: '#141414', gold: '#c98a1b' }

/* ---------- building blocks ---------- */

/** Soft round backdrop + a few confetti dots so the scene has a stage. */
const Stage = ({ color = CREAM, dots = [] }) => (
  <g>
    <circle cx="150" cy="158" r="118" fill={color} />
    {dots.map(([x, y, r, fill], i) => <circle key={i} cx={x} cy={y} r={r} fill={fill} />)}
  </g>
)

const Shadow = ({ x = 150, y = 276, rx = 62 }) => <ellipse cx={x} cy={y} rx={rx} ry="8" fill={INK} opacity="0.08" />

/** Head with hair and a small smile. Local origin = head centre. */
const Head = ({ skin, hair, style = 'short' }) => (
  <g>
    <circle r="24" fill={skin} />
    {style === 'long' && <path d="M-27 -2 Q-30 30 -22 40 L-14 40 Q-20 20 -18 -2 Z M27 -2 Q30 30 22 40 L14 40 Q20 20 18 -2 Z" fill={hair} />}
    <path d="M-25 -2 Q-25 -30 0 -30 Q25 -30 25 -2 Q13 -12 0 -10 Q-13 -12 -25 -2 Z" fill={hair} />
    {style === 'bun' && <circle cx="16" cy="-26" r="9" fill={hair} />}
    {style === 'cap' && <g><path d="M-26 -4 Q-26 -32 0 -32 Q26 -32 26 -4 Z" fill={GOLD} /><rect x="-30" y="-8" width="60" height="7" rx="3.5" fill={GOLD_DARK} /></g>}
    <circle cx="-8" cy="3" r="2.4" fill={INK} />
    <circle cx="8" cy="3" r="2.4" fill={INK} />
    <path d="M-6 12 Q0 17 6 12" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="-15" cy="10" r="4" fill="#f08a8a" opacity="0.35" />
    <circle cx="15" cy="10" r="4" fill="#f08a8a" opacity="0.35" />
  </g>
)

/**
 * A standing person. Origin (x, y) is the head centre; the figure is ~200 tall.
 * `arms` = [leftPath, rightPath] in local coords starting at the shoulders (±30, 42);
 * `hands` = [[x, y], [x, y]] where the hands end up. `behind` renders between body and arms
 * (e.g. a carried box) so the arms wrap around it.
 */
function Person({ x = 150, y = 78, skin = SKIN.light, hair = HAIR.dark, hairStyle = 'short', shirt = NAVY, pants = INK, shoes = INK, arms, hands, behind, front, sit = false }) {
  const [leftArm, rightArm] = arms || ['M-30 42 Q-50 70 -44 98', 'M30 42 Q50 70 44 98']
  const [leftHand, rightHand] = hands || [[-44, 102], [44, 102]]
  return (
    <g transform={`translate(${x} ${y})`}>
      {!sit && (
        <g>
          <rect x="-30" y="98" width="26" height="72" rx="11" fill={pants} />
          <rect x="4" y="98" width="26" height="72" rx="11" fill={pants} />
          <rect x="-34" y="164" width="33" height="14" rx="7" fill={shoes} />
          <rect x="1" y="164" width="33" height="14" rx="7" fill={shoes} />
        </g>
      )}
      <rect x="-7" y="18" width="14" height="16" rx="5" fill={skin} />
      <path d="M-38 46 Q-38 30 -22 30 L22 30 Q38 30 38 46 L36 106 L-36 106 Z" fill={shirt} />
      {behind}
      <path d={leftArm} fill="none" stroke={shirt} strokeWidth="15" strokeLinecap="round" />
      <path d={rightArm} fill="none" stroke={shirt} strokeWidth="15" strokeLinecap="round" />
      <circle cx={leftHand[0]} cy={leftHand[1]} r="8" fill={skin} />
      <circle cx={rightHand[0]} cy={rightHand[1]} r="8" fill={skin} />
      <Head skin={skin} hair={hair} style={hairStyle} />
      {front}
    </g>
  )
}

const Star = ({ x, y, s = 1, fill = GOLD }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -9 L2.6 -2.6 9 0 2.6 2.6 0 9 -2.6 2.6 -9 0 -2.6 -2.6z" fill={fill} />
)

const Svg = ({ children, ...props }) => (
  <svg viewBox="0 0 300 300" role="img" {...props}>{children}</svg>
)

/* ---------- scenes ---------- */

/** Cleaning: sweeping with a broom, dust sparkles flying. */
export function BroomMascot(props) {
  return (
    <Svg {...props}>
      <Stage color={CREAM} dots={[[52, 70, 6, MINT], [252, 96, 5, GOLD], [236, 236, 7, MINT]]} />
      <Shadow />
      <Person
        skin={SKIN.tan} hair={HAIR.dark} hairStyle="bun" shirt={GOLD} pants={NAVY}
        arms={['M-30 42 Q-24 70 -2 74', 'M30 42 Q44 80 26 106']}
        hands={[[-2, 76], [26, 108]]}
        front={<g>
          <path d="M-36 34 L62 150" stroke={GOLD_DARK} strokeWidth="7" strokeLinecap="round" />
          <rect x="40" y="128" width="46" height="16" rx="8" transform="rotate(50 63 136)" fill={NAVY} />
          <path d="M50 148 L96 166 L82 206 L34 190 Z" fill={MINT} />
          <path d="M48 176 L82 188 M52 164 L88 176 M44 188 L76 200" stroke={MINT_DARK} strokeWidth="3" strokeLinecap="round" />
          <circle cx="-2" cy="76" r="8" fill={SKIN.tan} />
          <circle cx="26" cy="108" r="8" fill={SKIN.tan} />
        </g>}
      />
      <Star x="232" y="176" s="0.9" fill={MINT_DARK} />
      <Star x="256" y="208" s="0.6" fill={GOLD} />
      <Star x="226" y="228" s="0.5" fill={MINT_DARK} />
    </Svg>
  )
}

/** Repairs: proud handyman with a big wrench and a toolbox. */
export function WrenchMascot(props) {
  return (
    <Svg {...props}>
      <Stage color={SKY} dots={[[60, 60, 6, GOLD], [246, 84, 5, MINT], [46, 214, 6, MINT]]} />
      <Shadow />
      <Person
        skin={SKIN.light} hair={HAIR.brown} hairStyle="cap" shirt={NAVY} pants={BLUE}
        arms={['M-30 42 Q-56 66 -50 98', 'M30 42 Q66 30 62 -6']}
        hands={[[-50, 102], [62, -10]]}
        front={<g transform="translate(62 -10) rotate(-30)">
          <rect x="-7" y="-4" width="14" height="62" rx="7" fill={GOLD} />
          <circle cx="0" cy="-8" r="17" fill={GOLD} />
          <path d="M-8 -22 L8 -22 L8 -8 L-8 -8 Z" fill={SKY} />
          <circle cx="0" cy="-8" r="6" fill={GOLD_DARK} opacity="0.35" />
        </g>}
      />
      <g transform="translate(206 218)">
        <rect x="-36" y="-22" width="72" height="44" rx="8" fill={GOLD} />
        <rect x="-36" y="-22" width="72" height="12" rx="6" fill={GOLD_DARK} />
        <rect x="-12" y="-32" width="24" height="12" rx="6" fill={NAVY} />
        <rect x="-8" y="-10" width="16" height="10" rx="3" fill={NAVY} />
      </g>
    </Svg>
  )
}

/** Moving: carrying a taped box with a smile. */
export function BoxMascot(props) {
  return (
    <Svg {...props}>
      <Stage color={MIST} dots={[[56, 78, 6, GOLD], [250, 70, 5, GOLD], [244, 226, 7, MINT]]} />
      <Shadow />
      <Person
        skin={SKIN.deep} hair={HAIR.black} shirt={MINT_DARK} pants={NAVY}
        arms={['M-30 42 Q-56 70 -40 84', 'M30 42 Q56 70 40 84']}
        hands={[[-44, 92], [44, 92]]}
        behind={<g>
          <path d="M-46 62 L-30 48 L46 48 L30 62 Z" fill={GOLD_LIGHT} />
          <rect x="-46" y="62" width="76" height="58" rx="4" fill={GOLD} />
          <rect x="30" y="62" width="16" height="58" fill={GOLD_DARK} />
          <rect x="-46" y="80" width="76" height="8" fill={NAVY} opacity="0.85" />
          <rect x="-18" y="62" width="20" height="58" fill={GOLD_DARK} opacity="0.35" />
        </g>}
      />
      <g transform="translate(64 226)">
        <rect x="-26" y="-18" width="52" height="36" rx="4" fill={GOLD_LIGHT} />
        <rect x="-26" y="-6" width="52" height="6" fill={NAVY} opacity="0.7" />
      </g>
    </Svg>
  )
}

/** Painting: fresh gold stripe on the wall, roller in hand. */
export function RollerMascot(props) {
  return (
    <Svg {...props}>
      <Stage color={CREAM} dots={[[250, 78, 6, MINT], [232, 236, 5, GOLD]]} />
      <rect x="30" y="50" width="76" height="204" rx="10" fill={SKY} />
      <rect x="42" y="60" width="52" height="118" rx="8" fill={GOLD} />
      <path d="M42 178 Q55 166 68 178 Q81 190 94 178 L94 160 L42 160 Z" fill={GOLD} />
      <Shadow x="176" />
      <Person
        x="176" skin={SKIN.light} hair={HAIR.gold} hairStyle="long" shirt={NAVY} pants={BLUE}
        arms={['M-30 42 Q-62 46 -78 70', 'M30 42 Q50 72 40 100']}
        hands={[[-80, 74], [40, 104]]}
        front={<g>
          <path d="M-80 74 L-96 74 L-96 60 L-112 60" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="-138" y="36" width="28" height="48" rx="8" fill={GOLD_DARK} />
          <rect x="-134" y="40" width="6" height="40" rx="3" fill={GOLD_LIGHT} opacity="0.7" />
          <circle cx="-80" cy="74" r="8" fill={SKIN.light} />
        </g>}
      />
    </Svg>
  )
}

/** Anything / IT: at the laptop, with a check bubble. */
export function LaptopMascot(props) {
  return (
    <Svg {...props}>
      <Stage color={SKY} dots={[[56, 70, 6, GOLD], [248, 66, 5, MINT], [246, 222, 7, GOLD]]} />
      <Person
        y="96" sit skin={SKIN.tan} hair={HAIR.dark} shirt={GOLD} pants={NAVY}
        arms={['M-30 42 Q-44 78 -28 92', 'M30 42 Q44 78 28 92']}
        hands={[[-24, 98], [24, 98]]}
      />
      <rect x="56" y="196" width="188" height="16" rx="8" fill={NAVY} />
      <rect x="66" y="212" width="12" height="52" rx="6" fill={NAVY} />
      <rect x="222" y="212" width="12" height="52" rx="6" fill={NAVY} />
      <g transform="translate(150 178)">
        <rect x="-52" y="-4" width="104" height="10" rx="5" fill={INK} />
        <path d="M-46 -4 L-40 -62 L46 -62 L52 -4 Z" fill={BLUE} />
        <path d="M-40 -8 L-35 -56 L41 -56 L46 -8 Z" fill={MINT} />
      </g>
      <g transform="translate(232 112)">
        <circle r="24" fill={GOLD} />
        <path d="M-10 0 L-3 7 L11 -8" fill="none" stroke={NAVY} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M-10 18 L-18 30 L2 22 Z" fill={GOLD} />
      </g>
    </Svg>
  )
}

/** Pay only when happy: phone with a confirmed payment, shield beside it. */
export function WalletMascot(props) {
  return (
    <Svg {...props}>
      <Stage color={CREAM} dots={[[54, 64, 6, MINT], [246, 240, 6, MINT]]} />
      <Shadow x="140" />
      <Person
        x="140" skin={SKIN.deep} hair={HAIR.black} hairStyle="bun" shirt={NAVY} pants={BLUE}
        arms={['M-30 42 Q-54 70 -46 98', 'M30 42 Q66 52 52 40']}
        hands={[[-46, 102], [50, 40]]}
        front={<g transform="translate(66 12)">
          <rect x="-16" y="-30" width="32" height="56" rx="7" fill={INK} />
          <rect x="-12" y="-24" width="24" height="44" rx="4" fill={WHITE} />
          <circle cx="0" cy="-8" r="8" fill={MINT} />
          <path d="M-4 -8 L-1 -5 L4 -11" fill="none" stroke={NAVY} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="-8" y="6" width="16" height="3" rx="1.5" fill={NAVY} opacity="0.5" />
          <rect x="-6" y="12" width="12" height="3" rx="1.5" fill={NAVY} opacity="0.3" />
        </g>}
      />
      <g transform="translate(238 172)">
        <path d="M0 -34 L28 -22 L28 2 Q28 26 0 38 Q-28 26 -28 2 L-28 -22 Z" fill={GOLD} />
        <path d="M-12 0 L-3 9 L14 -10" fill="none" stroke={NAVY} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="translate(60 214)">
        <ellipse cx="0" cy="18" rx="22" ry="8" fill={GOLD_DARK} />
        <ellipse cx="0" cy="10" rx="22" ry="8" fill={GOLD} />
        <ellipse cx="0" cy="2" rx="22" ry="8" fill={GOLD_DARK} />
        <ellipse cx="0" cy="-6" rx="22" ry="8" fill={GOLD} />
        <text x="0" y="-3" textAnchor="middle" fontSize="8" fontWeight="800" fill={NAVY} fontFamily="Manrope, sans-serif">KM</text>
      </g>
    </Svg>
  )
}

/** A small rated profile card (used by FindMascot). */
const ProfileCard = ({ x, y, tone }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="-32" y="-22" width="64" height="44" rx="8" fill={WHITE} />
    <circle cx="-17" cy="-5" r="8" fill={tone} />
    <rect x="-5" y="-10" width="28" height="4" rx="2" fill={NAVY} opacity="0.6" />
    <rect x="-5" y="-2" width="20" height="4" rx="2" fill={NAVY} opacity="0.3" />
    <Star x="-22" y="13" s="0.42" /><Star x="-12" y="13" s="0.42" /><Star x="-2" y="13" s="0.42" /><Star x="8" y="13" s="0.42" /><Star x="18" y="13" s="0.42" />
  </g>
)

/** Find trusted people: magnifier over rated profile cards. */
export function FindMascot(props) {
  return (
    <Svg {...props}>
      <Stage color={MIST} dots={[[250, 82, 6, GOLD], [46, 236, 6, GOLD]]} />
      <ProfileCard x="70" y="86" tone={GOLD} />
      <ProfileCard x="76" y="146" tone={MINT} />
      <Shadow x="180" />
      <Person
        x="180" skin={SKIN.light} hair={HAIR.brown} shirt={MINT_DARK} pants={NAVY}
        arms={['M-30 42 Q-58 50 -70 76', 'M30 42 Q54 66 42 100']}
        hands={[[-72, 80], [42, 104]]}
        front={<g transform="translate(-98 50)">
          <circle r="30" fill={WHITE} opacity="0.35" />
          <circle r="30" fill="none" stroke={NAVY} strokeWidth="9" />
          <path d="M20 20 L28 30" stroke={NAVY} strokeWidth="12" strokeLinecap="round" />
          <path d="M-14 -12 Q-6 -20 4 -18" fill="none" stroke={WHITE} strokeWidth="4" strokeLinecap="round" opacity="0.8" />
          <circle cx="26" cy="30" r="8" fill={SKIN.light} />
        </g>}
      />
    </Svg>
  )
}

/** Earn: money landing on the balance, coins in the air. */
export function EarnMascot(props) {
  return (
    <Svg {...props}>
      <Stage color={CREAM} dots={[[48, 72, 6, MINT], [250, 232, 6, MINT]]} />
      <Shadow />
      <Person
        skin={SKIN.tan} hair={HAIR.dark} hairStyle="long" shirt={NAVY} pants={BLUE}
        arms={['M-30 42 Q-66 30 -62 -4', 'M30 42 Q66 30 62 -4']}
        hands={[[-62, -8], [62, -8]]}
      />
      {[[88, 40, 1], [212, 40, 1], [150, 14, 0.8], [62, 96, 0.7], [238, 96, 0.7]].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <circle r="16" fill={GOLD} />
          <circle r="11" fill="none" stroke={GOLD_DARK} strokeWidth="2" />
          <text y="4" textAnchor="middle" fontSize="10" fontWeight="800" fill={NAVY} fontFamily="Manrope, sans-serif">KM</text>
        </g>
      ))}
      <g transform="translate(150 236)">
        <rect x="-64" y="-18" width="128" height="36" rx="18" fill={MINT} />
        <circle cx="-44" cy="0" r="10" fill={NAVY} />
        <path d="M-48 0 L-45 3 L-40 -4" fill="none" stroke={MINT} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="-26" y="5" fontSize="14" fontWeight="800" fill={NAVY} fontFamily="Manrope, sans-serif">+ 120 KM</text>
      </g>
    </Svg>
  )
}

/** Messages: an envelope arriving, chat bubble waiting. */
export function MailMascot(props) {
  return (
    <Svg {...props}>
      <Stage color={SKY} dots={[[56, 226, 6, GOLD], [248, 232, 5, MINT]]} />
      <Shadow />
      <Person
        skin={SKIN.light} hair={HAIR.black} hairStyle="bun" shirt={GOLD} pants={NAVY}
        arms={['M-30 42 Q-52 70 -36 80', 'M30 42 Q52 70 36 80']}
        hands={[[-38, 86], [38, 86]]}
        behind={<g transform="translate(0 78)">
          <rect x="-44" y="-24" width="88" height="56" rx="8" fill={WHITE} />
          <path d="M-44 -20 L0 12 L44 -20" fill="none" stroke={NAVY} strokeWidth="5" strokeLinejoin="round" />
          <circle cx="36" cy="-20" r="9" fill={MINT_DARK} />
        </g>}
      />
      <g transform="translate(232 92)">
        <path d="M-34 -22 Q-34 -34 -22 -34 L22 -34 Q34 -34 34 -22 L34 4 Q34 16 22 16 L-6 16 L-24 30 L-22 16 Q-34 16 -34 4 Z" fill={NAVY} />
        <circle cx="-12" cy="-8" r="4" fill={GOLD} /><circle cx="0" cy="-8" r="4" fill={GOLD} /><circle cx="12" cy="-8" r="4" fill={GOLD} />
      </g>
    </Svg>
  )
}

/** Nothing here yet: an empty clipboard and a shrug. */
export function EmptyBoxMascot(props) {
  return (
    <Svg {...props}>
      <Stage color={MIST} dots={[[54, 66, 6, GOLD], [250, 74, 5, MINT], [242, 234, 6, GOLD]]} />
      <Shadow />
      <Person
        skin={SKIN.deep} hair={HAIR.black} shirt={NAVY} pants={BLUE}
        arms={['M-30 42 Q-52 70 -40 82', 'M30 42 Q70 40 66 10']}
        hands={[[-40, 88], [66, 6]]}
        behind={<g transform="translate(-46 84)">
          <rect x="-30" y="-40" width="60" height="80" rx="8" fill={WHITE} />
          <rect x="-14" y="-46" width="28" height="12" rx="6" fill={NAVY} />
          <rect x="-20" y="-18" width="40" height="5" rx="2.5" fill={SKY} />
          <rect x="-20" y="-4" width="40" height="5" rx="2.5" fill={SKY} />
          <rect x="-20" y="10" width="28" height="5" rx="2.5" fill={SKY} />
          <path d="M-8 26 Q0 34 8 26" fill="none" stroke={MINT_DARK} strokeWidth="3" strokeLinecap="round" />
        </g>}
      />
      <text x="228" y="96" fontSize="34" fontWeight="800" fill={GOLD} fontFamily="Manrope, sans-serif">?</text>
    </Svg>
  )
}

/** Success: task published — confetti and a thumbs-up. */
export function DoneMascot(props) {
  return (
    <Svg {...props}>
      <Stage color={CREAM} dots={[[56, 60, 6, MINT], [246, 70, 6, GOLD], [42, 226, 5, GOLD], [254, 232, 6, MINT]]} />
      <Shadow />
      <Person
        skin={SKIN.tan} hair={HAIR.brown} shirt={MINT_DARK} pants={NAVY}
        arms={['M-30 42 Q-50 72 -44 98', 'M30 42 Q66 30 62 -6']}
        hands={[[-44, 102], [62, -10]]}
        front={<g transform="translate(62 -10) rotate(-12)">
          <rect x="-11" y="-6" width="22" height="20" rx="6" fill={SKIN.tan} />
          <rect x="-3" y="-26" width="10" height="24" rx="5" fill={SKIN.tan} />
          <path d="M-11 0 L-11 12" stroke={GOLD_DARK} strokeWidth="0" />
        </g>}
      />
      <g transform="translate(230 118)">
        <circle r="26" fill={GOLD} />
        <path d="M-11 0 L-3 8 L12 -9" fill="none" stroke={NAVY} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <Star x="70" y="110" s="0.9" fill={GOLD} />
      <Star x="94" y="80" s="0.6" fill={MINT_DARK} />
      <Star x="228" y="196" s="0.7" fill={MINT_DARK} />
    </Svg>
  )
}
