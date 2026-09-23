import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createCallSession, startCall as rpcStartCall, updateCall } from '../lib/webrtc'

/**
 * Jedan poziv od zvona do prekida, za obje strane.
 *
 * Dolazni poziv stiže kroz Realtime na tabelu `calls` (INSERT gdje sam ja
 * `callee_id`). Signalizacija (SDP/ICE) ide posebnim broadcast kanalom — vidi
 * src/lib/webrtc.js. Baza odlučuje smije li poziv uopšte početi; ovdje je samo
 * stanje ekrana.
 */
export function useCalls(user, active) {
  const [call, setCall] = useState(null)        // { id, kind, role, state, otherName }
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const sessionRef = useRef(null)
  const localRef = useRef(null)
  const remoteRef = useRef(null)
  const localStreamRef = useRef(null)

  const cleanup = useCallback(async (state, reason) => {
    const session = sessionRef.current
    sessionRef.current = null
    localStreamRef.current = null
    const relay = session ? await session.close(reason) : null
    setCall((current) => {
      if (current?.id && state) updateCall(current.id, state, reason, relay)
      return null
    })
    setMuted(false)
    setCameraOff(false)
  }, [])

  // dolazni poziv: neko me zove
  useEffect(() => {
    if (!user?.id) return undefined
    let alive = true

    const ring = (row) => {
      if (!alive) return
      setCall((current) => (current ? current : {
        id: row.id, kind: row.kind, role: 'callee', state: 'incoming',
        conversationId: row.conversation_id,
      }))
    }

    // Realtime ne ponavlja propuštene događaje: poziv upućen dok se pretplata
    // uspostavljala (ili dok je veza pala) inače bi se izgubio bez traga.
    // Zato se pri otvaranju jednom provjeri ima li poziv koji upravo zvoni.
    const catchUp = async () => {
      const { data } = await supabase
        .from('calls')
        .select('id, kind, conversation_id, started_at')
        .eq('callee_id', user.id)
        .eq('state', 'ringing')
        .gt('started_at', new Date(Date.now() - 45_000).toISOString())
        .order('started_at', { ascending: false })
        .limit(1)
      if (data?.[0]) ring(data[0])
    }

    // jedinstveno ime kanala: Supabase vraca POSTOJECU instancu za isto ime, pa bi
    // drugi pretplatnik dobio vec pretplaceni kanal i `.on()` bi bacio gresku
    const channel = supabase
      .channel(`calls-${user.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${user.id}` },
        ({ new: row }) => ring(row))
      .subscribe((status) => { if (status === 'SUBSCRIBED') catchUp() })

    return () => { alive = false; supabase.removeChannel(channel) }
  }, [user?.id])

  // druga strana je prekinula prije nego je poziv počeo
  useEffect(() => {
    if (!call?.id) return undefined
    const channel = supabase
      .channel(`call-state-${call.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${call.id}` },
        ({ new: row }) => {
          if (['ended', 'missed', 'declined', 'failed'].includes(row.state)) cleanup(null, row.end_reason)
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [call?.id, cleanup])

  const attachStreams = useCallback((session, wantVideo) => {
    session.open({ video: wantVideo }).then((stream) => {
      localStreamRef.current = stream
      if (localRef.current) localRef.current.srcObject = stream
    }).catch((mediaError) => {
      setError(mediaError.name === 'NotAllowedError'
        ? 'Pristup mikrofonu/kameri nije dozvoljen.'
        : 'Ne mogu pristupiti mikrofonu ili kameri.')
      cleanup('failed', 'nema pristupa uređaju')
    })
  }, [cleanup])

  /** Ja zovem. Baza prvo provjeri je li posao u toku. */
  const conversationId = active?.id
  const dial = useCallback(async (kind) => {
    setError('')
    if (!conversationId) return
    try {
      const row = await rpcStartCall(conversationId, kind)
      const session = createCallSession({
        conversationId, callId: row.id, role: 'caller',
        onRemoteStream: (stream) => { if (remoteRef.current) remoteRef.current.srcObject = stream },
        onState: (state, detail) => {
          if (state === 'connected') { setCall((c) => c && { ...c, state: 'active' }); updateCall(row.id, 'active') }
          if (state === 'failed') { setError(detail || 'Veza nije uspostavljena.'); cleanup('failed', detail) }
          if (state === 'ended') cleanup(null)
        },
      })
      sessionRef.current = session
      setCall({ id: row.id, kind, role: 'caller', state: 'ringing', conversationId })
      attachStreams(session, kind === 'video')
    } catch (callError) {
      setError(callError.message)
    }
  }, [conversationId, cleanup, attachStreams])

  /** Javljam se na dolazni poziv. */
  const answer = useCallback(() => {
    if (!call || call.role !== 'callee') return
    const session = createCallSession({
      conversationId: call.conversationId, callId: call.id, role: 'callee',
      onRemoteStream: (stream) => { if (remoteRef.current) remoteRef.current.srcObject = stream },
      onState: (state, detail) => {
        if (state === 'connected') { setCall((c) => c && { ...c, state: 'active' }); updateCall(call.id, 'active') }
        if (state === 'failed') { setError(detail || 'Veza nije uspostavljena.'); cleanup('failed', detail) }
        if (state === 'ended') cleanup(null)
      },
    })
    sessionRef.current = session
    setCall((c) => c && { ...c, state: 'connecting' })
    attachStreams(session, call.kind === 'video')
  }, [call, cleanup, attachStreams])

  const decline = useCallback(() => cleanup('declined', 'odbijen poziv'), [cleanup])
  const hangUp = useCallback(() => cleanup('ended', 'prekinuto'), [cleanup])

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()?.[0]
    if (!track) return
    track.enabled = !track.enabled
    setMuted(!track.enabled)
  }, [])

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()?.[0]
    if (!track) return
    track.enabled = !track.enabled
    setCameraOff(!track.enabled)
  }, [])

  // poziv koji se ne javi prestaje zvoniti nakon 45 s — i kod pozivaoca i kod
  // pozvanog. Baza radi isto svake minute (expire_stale_calls), za slučaj da
  // obje strane zatvore aplikaciju.
  useEffect(() => {
    if (!call || !['ringing', 'incoming'].includes(call.state)) return undefined
    const timer = window.setTimeout(() => {
      setError(call.role === 'caller' ? 'Druga strana se nije javila.' : '')
      cleanup('missed', 'niko se nije javio')
    }, 45_000)
    return () => window.clearTimeout(timer)
  }, [call, cleanup])

  // ako korisnik zatvori karticu usred poziva, zapis ne smije ostati "u toku"
  useEffect(() => {
    const onUnload = () => { if (call?.id) updateCall(call.id, 'ended', 'zatvorena kartica') }
    window.addEventListener('pagehide', onUnload)
    return () => window.removeEventListener('pagehide', onUnload)
  }, [call?.id])

  return { call, error, setError, muted, cameraOff, localRef, remoteRef, dial, answer, decline, hangUp, toggleMute, toggleCamera }
}
