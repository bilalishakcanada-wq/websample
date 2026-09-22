/**
 * Audio/video pozivi unutar aplikacije.
 *
 * Signalizacija ide preko Supabase Realtime broadcast kanala, ne preko zasebnog
 * Socket.io servera. Razlog: SDP i ICE poruke su prolazne (ne cuvaju se), a
 * Realtime kanal vec postoji, vec je autentifikovan istim JWT-om i ne treba ga
 * posebno postavljati, skalirati ni osiguravati. Socket.io bi bio jos jedan
 * servis u putanji — bez ijedne prednosti za dva ucesnika po pozivu.
 *
 * Sto Realtime NE moze: probiti simetricni NAT. Za to treba TURN relej
 * (vidi ICE_SERVERS ispod). Bez njega dio poziva na mobilnim mrezama pada.
 */
import { supabase } from './supabase'

/**
 * STUN je besplatan i dovoljan za vecinu veza. TURN je placen i obavezan za
 * ostatak. Kredencijali TURN-a moraju biti KRATKOROCNI i izdati sa servera
 * (Edge funkcija), nikad upisani u frontend build — inace ih svako moze
 * iscitati iz koda i koristiti vas relej.
 */
const STUN_ONLY = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]

async function iceServers() {
  try {
    const { data, error } = await supabase.functions.invoke('turn-credentials')
    if (error || !data?.iceServers) return STUN_ONLY
    return data.iceServers
  } catch {
    return STUN_ONLY   // bez TURN-a poziv radi samo kad NAT dozvoli
  }
}

const CHANNEL = (conversationId) => `call:${conversationId}`

/**
 * Jedan poziv, s obje strane. `role` je 'caller' ili 'callee'.
 *
 * Tok: caller salje offer -> callee salje answer -> obje strane razmjenjuju ICE
 * kandidate dok se veza ne uspostavi. Svaka poruka nosi callId, pa zakasnjeli
 * signali iz prethodnog poziva ne mogu upasti u novi.
 */
export function createCallSession({ conversationId, callId, role, onRemoteStream, onState }) {
  let pc = null
  let channel = null
  let localStream = null
  let closed = false
  const pendingCandidates = []

  const setState = (state, detail) => onState?.(state, detail)

  async function open({ video }) {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video })

    pc = new RTCPeerConnection({ iceServers: await iceServers() })
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))

    pc.ontrack = (event) => onRemoteStream?.(event.streams[0])
    pc.onicecandidate = (event) => {
      if (event.candidate) send('ice', { candidate: event.candidate.toJSON() })
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setState('connected')
      if (pc.connectionState === 'failed') setState('failed', 'veza nije uspostavljena')
      if (pc.connectionState === 'disconnected') setState('disconnected')
    }

    channel = supabase.channel(CHANNEL(conversationId), { config: { broadcast: { self: false } } })
    channel.on('broadcast', { event: 'signal' }, ({ payload }) => handle(payload))
    await channel.subscribe()

    if (role === 'caller') {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      send('offer', { sdp: offer })
      setState('ringing')
    }
    return localStream
  }

  function send(type, data) {
    channel?.send({ type: 'broadcast', event: 'signal', payload: { type, callId, from: role, ...data } })
  }

  async function handle(msg) {
    if (closed || msg.callId !== callId || msg.from === role) return
    try {
      if (msg.type === 'offer' && role === 'callee') {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
        await drainCandidates()
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        send('answer', { sdp: answer })
        setState('answering')
      } else if (msg.type === 'answer' && role === 'caller') {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
        await drainCandidates()
      } else if (msg.type === 'ice') {
        // kandidati znaju stici prije opisa: tada ih pricuvaj
        if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
        else pendingCandidates.push(msg.candidate)
      } else if (msg.type === 'hangup') {
        setState('ended', msg.reason)
        await close(msg.reason || 'druga strana je prekinula')
      }
    } catch (error) {
      setState('failed', error.message)
    }
  }

  async function drainCandidates() {
    while (pendingCandidates.length) {
      await pc.addIceCandidate(new RTCIceCandidate(pendingCandidates.shift())).catch(() => {})
    }
  }

  /** Je li veza isla preko releja — pise se u dnevnik poziva zbog dijagnostike. */
  async function usedRelay() {
    try {
      const stats = await pc.getStats()
      for (const report of stats.values()) {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          for (const c of stats.values()) {
            if (c.id === report.localCandidateId) return c.candidateType === 'relay'
          }
        }
      }
    } catch { /* nebitno */ }
    return null
  }

  async function close(reason = 'prekinuto') {
    if (closed) return
    closed = true
    const relay = pc ? await usedRelay() : null
    send('hangup', { reason })
    localStream?.getTracks().forEach((t) => t.stop())
    pc?.close()
    if (channel) await supabase.removeChannel(channel)
    return relay
  }

  return { open, close, hangupSignal: (reason) => send('hangup', { reason }) }
}

/** Zapocinje poziv: baza prvo provjeri smije li (posao mora biti u toku). */
export async function startCall(conversationId, kind = 'audio') {
  const { data, error } = await supabase.rpc('start_call', { p_conversation: conversationId, p_kind: kind })
  if (error) throw new Error(errorMessage(error))
  return data
}

export async function updateCall(callId, state, reason = null, usedRelay = null) {
  const { error } = await supabase.rpc('update_call', {
    p_call: callId, p_state: state, p_reason: reason, p_used_relay: usedRelay,
  })
  if (error) console.error('Zapis poziva nije azuriran', error.message)
}

function errorMessage(error) {
  const text = String(error.message || '')
  if (text.includes('POZIVI_NISU_DOSTUPNI')) return 'Pozivi rade samo dok je posao u toku.'
  if (text.includes('PREVISE_POZIVA')) return 'Previše poziva zaredom — sačekaj nekoliko minuta.'
  if (text.includes('FORBIDDEN')) return 'Nemaš pristup ovom razgovoru.'
  return 'Poziv se ne može uspostaviti.'
}
