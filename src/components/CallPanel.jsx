import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react'

/**
 * Ekran poziva preko cijelog prozora: zvoni (dolazni/odlazni), pa razgovor.
 * Audio poziv pokazuje avatar; video pokazuje sliku druge strane, a moja je
 * mala u uglu. Dugmad su ≥56 px, da se pogode i u žurbi.
 */
/** isti oblik avatara kao u chatu — bez slike ide inicijal */
const Avatar = ({ src, name, size = 96 }) => (src
  ? <img src={src} alt="" width={size} height={size} className="call-avatar" />
  : <span className="call-avatar call-avatar-empty" style={{ width: size, height: size }}>{(name || '?').trim().charAt(0).toUpperCase()}</span>)

function CallPanel({ call, other, muted, cameraOff, localRef, remoteRef, onAnswer, onDecline, onHangUp, onToggleMute, onToggleCamera }) {
  if (!call) return null
  const video = call.kind === 'video'
  const incoming = call.role === 'callee' && call.state === 'incoming'
  const active = call.state === 'active'

  const naslov = incoming ? (video ? 'Video poziv' : 'Audio poziv')
    : call.state === 'ringing' ? 'Zvoni…'
      : active ? 'Razgovor u toku' : 'Povezivanje…'

  return (
    <div className="call-panel" role="dialog" aria-modal="true" aria-label={naslov}>
      <div className="call-stage">
        {video && <video ref={remoteRef} className="call-remote" autoPlay playsInline />}
        {!video && <audio ref={remoteRef} autoPlay />}
        {(!video || !active) && (
          <div className="call-person">
            <Avatar src={other?.other_avatar} name={other?.other_name} size={96} />
            <strong>{other?.other_name || 'Korisnik'}</strong>
            <span>{naslov}</span>
          </div>
        )}
        {video && <video ref={localRef} className="call-local" autoPlay playsInline muted />}
        {!video && <video ref={localRef} hidden autoPlay playsInline muted />}
      </div>

      <div className="call-actions">
        {incoming ? (
          <>
            <button type="button" className="call-btn call-decline" onClick={onDecline} aria-label="Odbij">
              <PhoneOff size={26} />
            </button>
            <button type="button" className="call-btn call-answer" onClick={onAnswer} aria-label="Javi se">
              <Phone size={26} />
            </button>
          </>
        ) : (
          <>
            <button type="button" className={`call-btn call-toggle ${muted ? 'off' : ''}`} onClick={onToggleMute} aria-label={muted ? 'Uključi mikrofon' : 'Isključi mikrofon'}>
              {muted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            {video && (
              <button type="button" className={`call-btn call-toggle ${cameraOff ? 'off' : ''}`} onClick={onToggleCamera} aria-label={cameraOff ? 'Uključi kameru' : 'Isključi kameru'}>
                {cameraOff ? <VideoOff size={22} /> : <Video size={22} />}
              </button>
            )}
            <button type="button" className="call-btn call-decline" onClick={onHangUp} aria-label="Prekini">
              <PhoneOff size={26} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default CallPanel
