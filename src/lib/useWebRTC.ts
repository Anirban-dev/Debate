import { useCallback, useEffect, useRef, useState } from 'react';
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
  ],
};

export function useWebRTC(
  socket: Socket | null,
  roomState: MatchRoomState | null,
  currentUser: Player | null
): WebRTCState {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [micAudioLevels] = useState<Record<string, number>>({});

  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidates = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentUserRef = useRef<Player | null>(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Attach/update local tracks across all active peer connections
  const syncLocalTracksToPeers = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    Object.entries(peerConnections.current).forEach(async ([remoteUser, pc]) => {
      let tracksAdded = false;
      stream.getTracks().forEach((track) => {
        const senders = pc.getSenders();
        const existingSender = senders.find(s => s.track && s.track.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track).catch(() => {});
        } else {
          try {
            pc.addTrack(track, stream);
            tracksAdded = true;
          } catch (_) {}
        }
      });

      if (tracksAdded && socket && currentUserRef.current) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc_offer', {
            targetUsername: remoteUser,
            offer,
            senderUsername: currentUserRef.current.username,
          });
        } catch (err) {
          console.warn('Error sending renegotiation offer:', err);
        }
      }
    });
  }, [socket]);

  // Helper to get or create RTCPeerConnection for a remote player
  const getOrCreatePeerConnection = useCallback((targetUsername: string): RTCPeerConnection => {
    const targetKey = targetUsername.toLowerCase();
    if (peerConnections.current[targetKey]) {
      return peerConnections.current[targetKey];
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.current[targetKey] = pc;

    // Add audio & video transceivers to guarantee sendrecv directionality in SDP offers
    try {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
    } catch (_) {}

    // Attach local stream tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        const senders = pc.getSenders();
        const existingSender = senders.find((s) => s.track?.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track).catch(() => {});
        } else {
          try {
            pc.addTrack(track, localStreamRef.current!);
          } catch (_) {}
        }
      });
    }

    // Handle remote media track - Always construct a new MediaStream instance so React updates state
    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const existingStream = prev[targetKey];
        let updatedStream: MediaStream;

        if (existingStream) {
          if (!existingStream.getTracks().some((t) => t.id === event.track.id)) {
            existingStream.addTrack(event.track);
          }
          updatedStream = new MediaStream(existingStream.getTracks());
        } else if (event.streams && event.streams[0]) {
          updatedStream = new MediaStream(event.streams[0].getTracks());
        } else {
          updatedStream = new MediaStream([event.track]);
        }

        return {
          ...prev,
          [targetKey]: updatedStream,
        };
      });
    };

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && currentUserRef.current) {
        socket.emit('webrtc_ice_candidate', {
          targetUsername: targetKey,
          candidate: event.candidate,
          senderUsername: currentUserRef.current.username,
        });
      }
    };

    // Handle Connection State
    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed'
      ) {
        setRemoteStreams((prev) => {
          const updated = { ...prev };
          delete updated[targetKey];
          return updated;
        });
      }
    };

    return pc;
  }, [socket]);

  // 1. Initialize Local Media Stream (Camera & Microphone)
  useEffect(() => {
    const targetUsername = currentUser?.username;
    const targetRole = currentUser?.role;

    if (!targetUsername || targetRole === 'spectator') {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
      return;
    }

    let isMounted = true;

    async function initLocalStream() {
      if (localStreamRef.current) return;

      let stream: MediaStream | null = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { max: 30 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch (err1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (err2) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (err3) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (err4) {
              console.error('All getUserMedia attempts failed:', err4);
            }
          }
        }
      }

      if (!isMounted) {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        return;
      }

      if (stream) {
        localStreamRef.current = stream;

        // Apply current mute / video off settings
        if (currentUserRef.current) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) videoTrack.enabled = !currentUserRef.current.isVideoOff;

          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) audioTrack.enabled = !currentUserRef.current.isMuted;
        }

        setLocalStream(stream);

        // Sync local tracks with all existing peer connections and request streams
        syncLocalTracksToPeers();

        if (socket && currentUserRef.current) {
          socket.emit('webrtc_request_stream', {
            targetUsername: 'all',
            senderUsername: currentUserRef.current.username,
          });
        }
      }
    }

    initLocalStream();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.username, currentUser?.role, socket, syncLocalTracksToPeers]);

  // Dynamic mute / video off updates on local tracks
  useEffect(() => {
    if (!localStreamRef.current || !currentUser) return;

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) videoTrack.enabled = !currentUser.isVideoOff;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) audioTrack.enabled = !currentUser.isMuted;
  }, [currentUser?.isVideoOff, currentUser?.isMuted, currentUser]);

  // 2. Setup Socket.IO Signaling Listeners
  useEffect(() => {
    if (!socket || !currentUser) return;

    const myUsername = currentUser.username.toLowerCase();

    // Handle incoming WebRTC Offer
    const handleOffer = async (data: { offer: RTCSessionDescriptionInit; senderUsername: string }) => {
      const sender = (data.senderUsername || '').toLowerCase();
      if (!sender || sender === myUsername) return;

      try {
        const pc = getOrCreatePeerConnection(sender);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        // Flush queued ICE candidates for this sender
        if (pendingCandidates.current[sender]) {
          for (const cand of pendingCandidates.current[sender]) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          delete pendingCandidates.current[sender];
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc_answer', {
          targetUsername: sender,
          answer,
          senderUsername: currentUser.username,
        });
      } catch (e) {
        console.warn('Error handling WebRTC offer:', e);
      }
    };

    // Handle incoming WebRTC Answer
    const handleAnswer = async (data: { answer: RTCSessionDescriptionInit; senderUsername: string }) => {
      const sender = (data.senderUsername || '').toLowerCase();
      if (!sender || sender === myUsername) return;

      try {
        const pc = peerConnections.current[sender];
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

          // Flush queued ICE candidates for this sender
          if (pendingCandidates.current[sender]) {
            for (const cand of pendingCandidates.current[sender]) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            delete pendingCandidates.current[sender];
          }
        }
      } catch (e) {
        console.warn('Error handling WebRTC answer:', e);
      }
    };

    // Handle incoming WebRTC ICE Candidate
    const handleCandidate = async (data: { candidate: RTCIceCandidateInit; senderUsername: string }) => {
      const sender = (data.senderUsername || '').toLowerCase();
      if (!sender || sender === myUsername || !data.candidate) return;

      try {
        const pc = peerConnections.current[sender];
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          if (!pendingCandidates.current[sender]) {
            pendingCandidates.current[sender] = [];
          }
          pendingCandidates.current[sender].push(data.candidate);
        }
      } catch (e) {
        console.warn('Error adding ICE candidate:', e);
      }
    };

    // Handle stream request
    const handleRequestStream = async (data: { senderUsername: string }) => {
      const sender = (data.senderUsername || '').toLowerCase();
      if (!sender || sender === myUsername) return;

      try {
        const pc = getOrCreatePeerConnection(sender);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('webrtc_offer', {
          targetUsername: sender,
          offer,
          senderUsername: currentUser.username,
        });
      } catch (e) {
        console.warn('Error initiating stream offer:', e);
      }
    };

    socket.on('webrtc_offer', handleOffer);
    socket.on('webrtc_answer', handleAnswer);
    socket.on('webrtc_ice_candidate', handleCandidate);
    socket.on('webrtc_request_stream', handleRequestStream);

    // Request stream connections from other active players
    socket.emit('webrtc_request_stream', {
      targetUsername: 'all',
      senderUsername: currentUser.username,
    });

    return () => {
      socket.off('webrtc_offer', handleOffer);
      socket.off('webrtc_answer', handleAnswer);
      socket.off('webrtc_ice_candidate', handleCandidate);
      socket.off('webrtc_request_stream', handleRequestStream);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, currentUser?.username, getOrCreatePeerConnection]);

  // Auto stream-sync whenever roomState updates and online participants exist
  useEffect(() => {
    if (!socket || !currentUser || !roomState?.players) return;

    const myUser = currentUser.username.toLowerCase();
    Object.values(roomState.players).forEach((p) => {
      const uname = p.username.toLowerCase();
      if (uname !== myUser && p.isOnline) {
        const pc = peerConnections.current[uname];
        if (!pc || pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
          socket.emit('webrtc_request_stream', {
            targetUsername: uname,
            senderUsername: currentUser.username,
          });
        }
      }
    });
  }, [socket, currentUser?.username, currentUser, roomState?.players]);

  // Clean up peer connections on unmount
  useEffect(() => {
    return () => {
      Object.values(peerConnections.current).forEach((pc) => {
        try {
          pc.close();
        } catch (_) {}
      });
      peerConnections.current = {};
    };
  }, []);

  const toggleCamera = (off: boolean) => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) track.enabled = !off;
    }
  };

  const toggleMic = (muted: boolean) => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) track.enabled = !muted;
    }
  };

  return {
    localStream,
    remoteStreams,
    micAudioLevels,
    toggleCamera,
    toggleMic,
  };
}
