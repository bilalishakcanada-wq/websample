/** Line drawing for the profile pages: a member card being filled in with a pencil, checked with a seal.
 *  One ink weight, one blue, one pale tint printed slightly off the card. Decorative only. */
function ProfileCardArt({ className = '' }) {
  return (
    <svg className={`profile-card-art ${className}`} viewBox="0 0 240 170" fill="none" stroke="#0b1640" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M40 34 L196 24 Q203 24 204 31 L210 118 Q210 125 203 126 L48 136 Q41 136 40 129 Z" fill="#dfe8ff" stroke="none" />
      <g transform="rotate(-4 120 80)">
        <path d="M30 32 Q30 26 36 26 L190 25.5 Q196 25.5 196 31.5 L196.5 121 Q196.5 127 190.5 127 L36 128 Q30 128 30 122 Z" fill="#fff" />
        <path d="M30 46 L196 45.5" strokeWidth="1.5" />
        <circle cx="40" cy="36" r="2.2" fill="#0b1640" stroke="none" />
        <circle cx="48" cy="36" r="2.2" fill="#0b1640" stroke="none" opacity=".35" />
        <path d="M44 60 Q44 56 48 56 L84 56 Q88 56 88 60 L88 104 Q88 108 84 108 L48 108 Q44 108 44 104 Z" fill="#1f5fff" stroke="none" />
        <circle cx="66" cy="76" r="9.5" fill="#fff" />
        <path d="M50 107 Q51 91 66 90 Q81 91 82 107" fill="#fff" />
        <path d="M102 62 L160 61.5" strokeWidth="3" />
        <path d="M102 76 L178 75.6" stroke="#9aa5bf" />
        <path d="M102 86 L170 85.6" stroke="#9aa5bf" />
        <path d="M102 96 L140 95.8" stroke="#9aa5bf" />
      </g>
      <circle cx="190" cy="118" r="17" fill="#fff" />
      <circle cx="190" cy="118" r="12" strokeWidth="1.5" strokeDasharray="2 3" />
      <path d="M184 118 L188.5 122.5 L196.5 113.5" stroke="#1f5fff" strokeWidth="2.6" />
      <g transform="rotate(38 150 140)">
        <path d="M110 134 L176 134 L176 146 L110 146 Z" fill="#fff" />
        <path d="M176 134 L190 140 L176 146" fill="#fff" />
        <path d="M186.5 138.5 L190 140 L186.5 141.5 Z" fill="#0b1640" />
        <path d="M110 134 L104 134 Q100 134 100 140 Q100 146 104 146 L110 146" fill="#1f5fff" />
        <path d="M118 134 L118 146" />
        <path d="M122 140 L170 140" strokeWidth="1.2" opacity=".5" />
      </g>
      <path d="M150 160 Q156 152 162 158 T174 156 T186 158" stroke="#1f5fff" strokeWidth="1.6" />
    </svg>
  )
}

export default ProfileCardArt
