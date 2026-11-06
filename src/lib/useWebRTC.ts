import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { MatchRoomState, Player } from '@/types';

export interface WebRTCState {
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  micAudioLevels: Record<string, number>;
  toggleCamera: (off: boolean) => void;
  toggleMic: (muted: boolean) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    ...(process.env.NEXT_PUBLIC_TURN_URL
      ? [{
          urls: process.env.NEXT_PUBLIC_TURN_URL,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME,
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
        }]
      : []),
  ],
};

export function useWebRTC(
  socket: Socket | null,
  roomState: MatchRoomState | null,
  currentUser: Player | null
): WebRTCState {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // React state only holds REFERENCES to stable MediaStream objects.
  // We NEVER replace a stream object once created – we mutate it in place.
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [micAudioLevels] = useState<Record<string, number>>({});

  // ─── Refs (survive renders, readable from any closure) ────────────────────
  const peerConnections   = useRef<Record<string, RTCPeerConnection>>({});
  const remoteStreamRefs  = useRef<Record<string, MediaStream>>({});   // stable stream objects
  const pendingCandidates = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const makingOffer       = useRef<Record<string, boolean>>({});
  const localStreamRef    = useRef<MediaStream | null>(null);
  const socketRef         = useRef<Socket | null>(null);
  const currentUserRef    = useRef<Player | null>(null);
  // Track online peers we've already attempted to connect so Effect 4 doesn't
  // spam request_stream on every server state broadcast.
  const reconnectAttempted = useRef<Set<string>>(new Set());

  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // ─── Add all local tracks to a peer connection (no duplicates) ────────────
  function attachLocalTracks(pc: RTCPeerConnection) {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((track) => {
      const alreadySending = pc.getSenders().some((s) => s.track === track);
      if (!alreadySending) {
        pc.addTrack(track, stream);
      }
    });
  }

  // ─── Create & send an SDP offer ───────────────────────────────────────────
  async function sendOffer(pc: RTCPeerConnection, targetKey: string) {
    const sock = socketRef.current;
    const me   = currentUserRef.current;
    if (!sock || !me) return;
    if (makingOffer.current[targetKey]) return;
    if (pc.signalingState !== 'stable') return;

    makingOffer.current[targetKey] = true;
    try {
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return; // re-check after async gap
      await pc.setLocalDescription(offer);
      sock.emit('webrtc_offer', {
        targetUsername: targetKey,
        offer: pc.localDescription,
        senderUsername: me.username,
      });
    } catch (err) {
      console.warn('[WebRTC] sendOffer error:', err);
    } finally {
      makingOffer.current[targetKey] = false;
    }
  }

  // ─── Get-or-create RTCPeerConnection ──────────────────────────────────────
  function getOrCreatePC(targetUsername: string): RTCPeerConnection {
    const targetKey = targetUsername.toLowerCase();
    if (peerConnections.current[targetKey]) {
      return peerConnections.current[targetKey];
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.current[targetKey] = pc;

    // Attach local tracks now; onnegotiationneeded will fire and trigger the offer
    attachLocalTracks(pc);

    // ── Remote tracks → mutate the STABLE MediaStream for this peer ──────────
    pc.ontrack = (event) => {
      const incomingTrack = event.track;

      // Ensure we have a stable stream object for this peer
      if (!remoteStreamRefs.current[targetKey]) {
        const stableStream = new MediaStream();
        remoteStreamRefs.current[targetKey] = stableStream;
        // Tell React a stream is now available (only once per peer)
        setRemoteStreams((prev) => ({ ...prev, [targetKey]: stableStream }));
      }

      const peerStream = remoteStreamRefs.current[targetKey]!;

      // Replace any existing track of the same kind (e.g. renegotiation)
      const existing = peerStream.getTracks().find((t) => t.kind === incomingTrack.kind);
      if (existing && existing.id !== incomingTrack.id) {
        peerStream.removeTrack(existing);
      }
      if (!peerStream.getTracks().some((t) => t.id === incomingTrack.id)) {
        peerStream.addTrack(incomingTrack);
        // NOTE: no setRemoteStreams – same object ref → no AbortError cascade
      }

      // Remove the track from the stable stream when it ends
      incomingTrack.onended = () => {
        const s = remoteStreamRefs.current[targetKey];
        if (s && s.getTracks().some((t) => t.id === incomingTrack.id)) {
          s.removeTrack(incomingTrack);
        }
      };
    };

    // ── ICE candidates ───────────────────────────────────────────────────────
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && currentUserRef.current) {
        socketRef.current.emit('webrtc_ice_candidate', {
          targetUsername: targetKey,
          candidate: event.candidate,
          senderUsername: currentUserRef.current.username,
        });
      }
    };

    // ── Negotiation needed (fired after addTrack) ────────────────────────────
    pc.onnegotiationneeded = () => {
      sendOffer(pc, targetKey);
    };

    // ── ICE failure → try restart ────────────────────────────────────────────
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    // ── Connection dead → clean up ───────────────────────────────────────────
    // 'disconnected' is often transient (ICE recovers by itself), so we do NOT
    // tear down the peer/stream on it – that would create a new MediaStream later.
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected') {
        pc.restartIce?.();
        return;
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        // Ignore if a newer PC has already replaced this one
        if (peerConnections.current[targetKey] !== pc) return;
        remoteStreamRefs.current[targetKey]?.getTracks().forEach((t) => t.stop());
        try { pc.close(); } catch (_) {}
        delete remoteStreamRefs.current[targetKey];
        delete peerConnections.current[targetKey];
        delete pendingCandidates.current[targetKey];
        delete makingOffer.current[targetKey];
        // Allow Effect 4 to issue a fresh reconnect attempt for this peer
        reconnectAttempted.current.delete(targetKey);
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[targetKey];
          return next;
        });
      }
    };

    return pc;
  }

  // ─── 1. Acquire local media ────────────────────────────────────────────────
  useEffect(() => {
    const role     = currentUser?.role;
    const username = currentUser?.username;

    if (!username || role === 'spectator') {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
      return;
    }

    if (localStreamRef.current) return; // already have stream

    let cancelled = false;

    async function initStream() {
      const attempts: MediaStreamConstraints[] = [
        {
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { max: 30 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        },
        { video: true, audio: true },
        { video: true },
        { audio: true },
      ];

      let stream: MediaStream | null = null;
      for (const constraints of attempts) {
        try { stream = await navigator.mediaDevices.getUserMedia(constraints); break; }
        catch (_) { /* try next */ }
      }

      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      if (!stream) return;

      // Apply current mute / video-off state
      const cu = currentUserRef.current;
      if (cu) {
        const vt = stream.getVideoTracks()[0];
        if (vt) vt.enabled = !cu.isVideoOff;
        const at = stream.getAudioTracks()[0];
        if (at) at.enabled = !cu.isMuted;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Attach to any PCs already created (shouldn't happen, but be safe)
      Object.values(peerConnections.current).forEach(attachLocalTracks);

      // Announce to room so others send us offers
      if (socketRef.current && currentUserRef.current) {
        socketRef.current.emit('webrtc_request_stream', {
          targetUsername: 'all',
          senderUsername: currentUserRef.current.username,
        });
      }
    }

    initStream();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.username, currentUser?.role]);

  // ─── 2. Sync local track enabled state (mute / video-off) ─────────────────
  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream || !currentUser) return;
    const vt = stream.getVideoTracks()[0];
    if (vt) vt.enabled = !currentUser.isVideoOff;
    const at = stream.getAudioTracks()[0];
    if (at) at.enabled = !currentUser.isMuted;
  }, [currentUser?.isVideoOff, currentUser?.isMuted, currentUser]);

  // ─── 3. Socket signaling listeners ────────────────────────────────────────
  useEffect(() => {
    if (!socket || !currentUser) return;

    const myUsername = currentUser.username.toLowerCase();

    // ── Offer received ────────────────────────────────────────────────────────
    const handleOffer = async (data: { offer: RTCSessionDescriptionInit; senderUsername: string }) => {
      const sender = (data.senderUsername || '').toLowerCase();
      if (!sender || sender === myUsername) return;

      try {
        const pc = getOrCreatePC(sender);
        const polite = myUsername > sender; // polite peer yields on collision
        const offerCollision = makingOffer.current[sender] || pc.signalingState !== 'stable';

        if (!polite && offerCollision) return; // impolite peer drops colliding offer

        if (offerCollision) {
          await pc.setLocalDescription({ type: 'rollback' });
          makingOffer.current[sender] = false;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        // Flush queued ICE candidates
        for (const cand of pendingCandidates.current[sender] ?? []) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        delete pendingCandidates.current[sender];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc_answer', {
          targetUsername: sender,
          answer: pc.localDescription,
          senderUsername: currentUser.username,
        });
      } catch (e) {
        console.warn('[WebRTC] handleOffer error:', e);
      }
    };

    // ── Answer received ───────────────────────────────────────────────────────
    const handleAnswer = async (data: { answer: RTCSessionDescriptionInit; senderUsername: string }) => {
      const sender = (data.senderUsername || '').toLowerCase();
      if (!sender || sender === myUsername) return;

      try {
        const pc = peerConnections.current[sender];
        if (!pc) return;

        // If we're not yet in the right state to apply the answer, wait briefly
        // (can happen during rapid ICE restarts or onnegotiationneeded races).
        if (pc.signalingState !== 'have-local-offer') {
          console.warn('[WebRTC] handleAnswer: unexpected signalingState', pc.signalingState, '– dropping answer from', sender);
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

        for (const cand of pendingCandidates.current[sender] ?? []) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        delete pendingCandidates.current[sender];
        // Answer applied — peer is now connected; mark as successfully reconnected
        reconnectAttempted.current.add(sender);
      } catch (e) {
        console.warn('[WebRTC] handleAnswer error:', e);
      }
    };

    // ── ICE candidate received ────────────────────────────────────────────────
    const handleCandidate = async (data: { candidate: RTCIceCandidateInit; senderUsername: string }) => {
      const sender = (data.senderUsername || '').toLowerCase();
      if (!sender || sender === myUsername || !data.candidate) return;

      const pc = peerConnections.current[sender];
      if (pc?.remoteDescription?.type) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
      } else {
        if (!pendingCandidates.current[sender]) pendingCandidates.current[sender] = [];
        pendingCandidates.current[sender].push(data.candidate);
      }
    };

    // ── Stream request received → ensure we have a PC and send offer ──────────
    const handleRequestStream = (data: { senderUsername: string }) => {
      const sender = (data.senderUsername || '').toLowerCase();
      if (!sender || sender === myUsername) return;

      const pc = getOrCreatePC(sender);
      // onnegotiationneeded fires asynchronously after addTrack (inside getOrCreatePC).
      // If the PC already existed with tracks, we need to nudge it manually.
      if (
        localStreamRef.current &&
        pc.signalingState === 'stable' &&
        pc.getSenders().some((s) => s.track !== null)
      ) {
        sendOffer(pc, sender);
      }
    };

    socket.on('webrtc_offer',          handleOffer);
    socket.on('webrtc_answer',         handleAnswer);
    socket.on('webrtc_ice_candidate',  handleCandidate);
    socket.on('webrtc_request_stream', handleRequestStream);

    // Announce to everyone in room so they send us offers
    socket.emit('webrtc_request_stream', {
      targetUsername: 'all',
      senderUsername: currentUser.username,
    });

    return () => {
      socket.off('webrtc_offer',          handleOffer);
      socket.off('webrtc_answer',         handleAnswer);
      socket.off('webrtc_ice_candidate',  handleCandidate);
      socket.off('webrtc_request_stream', handleRequestStream);
      // Reset reconnect tracking when socket/user changes so peers get a fresh attempt
      reconnectAttempted.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, currentUser?.username]);

  // ─── 4. Auto-reconnect to any online player that lost their PC ────────────
  // This effect fires on every server state broadcast (roomState.players changes
  // on every timer tick etc.). Guard with reconnectAttempted so we only send the
  // request_stream signal when a peer is *newly* seen or has a *failed/closed* PC.
  useEffect(() => {
    if (!socket || !currentUser || !roomState?.players) return;

    const myUser = currentUser.username.toLowerCase();
    Object.values(roomState.players).forEach((p) => {
      const uname = p.username.toLowerCase();
      if (uname === myUser || !p.isOnline) {
        // Clear tracking for peers that went offline so we reconnect when they return
        if (!p.isOnline) reconnectAttempted.current.delete(uname);
        return;
      }

      const pc = peerConnections.current[uname];
      const needsReconnect =
        !pc ||
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed';

      if (needsReconnect && !reconnectAttempted.current.has(uname)) {
        reconnectAttempted.current.add(uname);
        socket.emit('webrtc_request_stream', {
          targetUsername: uname,
          senderUsername: currentUser.username,
        });
      } else if (!needsReconnect && reconnectAttempted.current.has(uname)) {
        // PC is healthy — keep it in the set so we don't thrash
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomState?.players, currentUser?.username]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(peerConnections.current).forEach((pc) => { try { pc.close(); } catch (_) {} });
      peerConnections.current = {};
      Object.values(remoteStreamRefs.current).forEach((s) => s.getTracks().forEach((t) => t.stop()));
      remoteStreamRefs.current = {};
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, []);

  const toggleCamera = (off: boolean) => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) track.enabled = !off;
  };

  const toggleMic = (muted: boolean) => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = !muted;
  };

  return { localStream, remoteStreams, micAudioLevels, toggleCamera, toggleMic };
}
