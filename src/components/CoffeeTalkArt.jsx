// Empty chat: two fildžana and a džezva on a tepsija under Stari Most. In Bosnia a deal is made over coffee.
const INK = '#08164a'
const BLUE = '#1f5fff'
const SKY = '#a9c6ff'
const PALE = '#e8f0ff'
const COFFEE = '#5b3216'
const WOOD = '#c98b4e'

function Fildzan({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="14" rx="23" ry="5" fill="#fff" stroke={INK} strokeWidth="3" />
      <path d="M-16 -16H16L12 6C11 12 6 15 0 15C-6 15-11 12-12 6Z" fill="#fff" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      <ellipse cx="0" cy="-16" rx="16" ry="4" fill={COFFEE} stroke={INK} strokeWidth="3" />
      <path d="M-14 -5H14" stroke={BLUE} strokeWidth="3.5" />
      <path d="M-6 -26c-5-7 5-10 0-17M6 -26c-5-7 5-10 0-17" fill="none" stroke={SKY} strokeWidth="3" strokeLinecap="round" />
    </g>
  )
}

function CoffeeTalkArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 280 210" role="img" aria-label="Džezva i dva fildžana kafe ispod Starog mosta">
      <circle cx="140" cy="112" r="96" fill={PALE} />
      {/* Stari Most */}
      <g fill="none" stroke={SKY} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M62 128Q140 28 218 128" />
        <path d="M62 86Q140 60 218 86" />
        <path d="M46 128V82L54 72L62 82V128M218 128V82L226 72L234 82V128" />
      </g>
      {/* tepsija */}
      <ellipse cx="140" cy="172" rx="112" ry="20" fill={SKY} stroke={INK} strokeWidth="3.5" />
      <ellipse cx="140" cy="167" rx="96" ry="14" fill="#f4f8ff" stroke={INK} strokeWidth="2.5" />
      <path d="M58 167q8 6 16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0" fill="none" stroke={BLUE} strokeWidth="2" opacity=".5" />
      <Fildzan x={78} y={150} />
      <Fildzan x={204} y={150} />
      {/* rahat-lokum */}
      <rect x="160" y="156" width="14" height="12" rx="3" fill="#ffb3c1" stroke={INK} strokeWidth="2.5" />
      <rect x="170" y="160" width="14" height="12" rx="3" fill="#fff" stroke={INK} strokeWidth="2.5" />
      {/* džezva */}
      <g transform="translate(130 128)">
        <path d="M18 -20L58 -44" stroke={INK} strokeWidth="10" strokeLinecap="round" />
        <path d="M18 -20L58 -44" stroke={WOOD} strokeWidth="5" strokeLinecap="round" />
        <path d="M-20 -24H20L24 18C24 26 14 30 0 30C-14 30-24 26-24 18Z" fill={BLUE} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M-20 -24L-34 -32L-18 -30Z" fill={BLUE} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <rect x="-23" y="-31" width="46" height="9" rx="3" fill={SKY} stroke={INK} strokeWidth="3" />
        <path d="M-20 0H21M-18 12H22" stroke="#fff" strokeWidth="2.2" opacity=".8" />
        <path d="M-14 4l3 4 3-4M-4 4l3 4 3-4M6 4l3 4 3-4" fill="none" stroke="#fff" strokeWidth="1.8" opacity=".8" />
      </g>
      {/* the conversation: a question, and a yes */}
      <g transform="translate(22 30)">
        <path d="M10 0H66A10 10 0 0 1 76 10V30A10 10 0 0 1 66 40H34L22 52V40H10A10 10 0 0 1 0 30V10A10 10 0 0 1 10 0Z" fill="#fff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="24" cy="20" r="3.5" fill={INK} /><circle cx="38" cy="20" r="3.5" fill={INK} /><circle cx="52" cy="20" r="3.5" fill={INK} />
      </g>
      <g transform="translate(184 22)">
        <path d="M10 0H64A10 10 0 0 1 74 10V30A10 10 0 0 1 64 40H52V52L40 40H10A10 10 0 0 1 0 30V10A10 10 0 0 1 10 0Z" fill={BLUE} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M24 20L33 28L50 12" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

export default CoffeeTalkArt
