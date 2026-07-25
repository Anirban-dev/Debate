import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { MatchRoomState, Player } from '@/types';
import type Peer from 'peerjs';

export interface WebRTCState {
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  micAudioLevels: Record<string, number>;
  toggleCamera: (off: boolean) => void;
  toggleMic: (muted: boolean) => void;
}

export function useWebRTC(
  socket: Socket | null,
  roomState: MatchRoomState | null,
  currentUser: Player | null
): WebRTCState {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [micAudioLevels] = useState<Record<string, number>>({});

  const peerInstance = useRef<Peer | null>(null);
  const activeCalls = useRef<Record<string, any>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentUserRef = useRef<Player | null>(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // 1. Initialize Local Media Stream (Camera & Microphone)
  useEffect(() => {
    if (!currentUser || currentUser.role === 'spectator') {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
      return;
    }

    let isMounted = true;

    async function initLocalStream() {
      try {
        if (localStreamRef.current) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { max: 30 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;

        // Apply current mute / video off settings
        if (currentUserRef.current) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) videoTrack.enabled = !currentUserRef.current.isVideoOff;

          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) audioTrack.enabled = !currentUserRef.current.isMuted;
        }

        setLocalStream(stream);
      } catch (err) {
        console.warn('PeerJS Local getUserMedia Notice:', err);
      }
    }

    initLocalStream();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.username, currentUser?.role, currentUser]);

  // Dynamic mute / video off updates on local tracks
  useEffect(() => {
    if (!localStreamRef.current || !currentUser) return;

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) videoTrack.enabled = !currentUser.isVideoOff;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) audioTrack.enabled = !currentUser.isMuted;
  }, [currentUser?.isVideoOff, currentUser?.isMuted, currentUser]);

  // 2. Initialize PeerJS Client Connection
  useEffect(() => {
    if (!currentUser || !roomState?.roomId) return;

    let destroyed = false;

    async function initPeerJS() {
      try {
        const PeerJS = (await import('peerjs')).default;
        if (destroyed) return;

        // Peer ID format: roomId-username (sanitized)
        const peerId = `${roomState.roomId.toLowerCase()}-${currentUser.username.toLowerCase()}`.replace(/[^a-z0-9_-]/g, '');

        if (peerInstance.current) {
          peerInstance.current.destroy();
        }

        const peer = new PeerJS(peerId, {
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19020' },
              { urls: 'stun:stun1.l.google.com:19020' },
              { urls: 'stun:stun2.l.google.com:19020' },
              { urls: 'stun:stun3.l.google.com:19020' },
            ],
          },
          debug: 1,
        });

        peerInstance.current = peer;

        // Answer incoming calls from other peers in room
        peer.on('call', (call) => {
          const callerPeerId = call.peer;
          const callerUsername = callerPeerId.split('-').slice(1).join('-');

          // Answer with local stream (or fallback dummy stream)
          const streamToAnswer = localStreamRef.current || new MediaStream();
          call.answer(streamToAnswer);

          call.on('stream', (remoteStream) => {
            setRemoteStreams((prev) => ({
              ...prev,
              [callerUsername]: remoteStream,
            }));
          });

          call.on('close', () => {
            setRemoteStreams((prev) => {
              const updated = { ...prev };
              delete updated[callerUsername];
              return updated;
            });
          });

          activeCalls.current[callerUsername] = call;
        });

        peer.on('disconnected', () => {
          console.log('PeerJS disconnected from signaling server. Attempting auto-reconnect...');
          try {
            if (peer && !peer.destroyed) {
              peer.reconnect();
            }
          } catch (recErr) {
            console.warn('PeerJS reconnect failed:', recErr);
          }
        });

        peer.on('error', (err) => {
          if (err.type === 'unavailable-id') {
            console.log('PeerJS ID already active:', peerId);
          } else if (err.type === 'disconnected' || err.type === 'network' || err.message?.includes('Lost connection')) {
            console.warn('PeerJS connection dropped, attempting reconnect...');
            try {
              if (peer && !peer.destroyed && peer.disconnected) {
                peer.reconnect();
              }
            } catch (rErr) {
              // Ignore reconnection error
            }
          } else {
            console.warn('PeerJS Connection Error:', err.type, err);
          }
        });
      } catch (e) {
        console.error('PeerJS import/initialization failed:', e);
      }
    }

    initPeerJS();

    return () => {
      destroyed = true;
      if (peerInstance.current) {
        peerInstance.current.destroy();
        peerInstance.current = null;
      }
    };
  }, [currentUser?.username, roomState?.roomId, currentUser]);

  // 3. Initiate calls to other active players in room using PeerJS
  useEffect(() => {
    if (!peerInstance.current || !roomState || !currentUser || !localStream) return;

    const currentPeer = peerInstance.current;
    const myUsername = currentUser.username.toLowerCase();

    Object.values(roomState.players).forEach((p) => {
      const targetUser = p.username.toLowerCase();
      if (targetUser === myUsername || !p.isOnline) return;

      const targetPeerId = `${roomState.roomId.toLowerCase()}-${targetUser}`.replace(/[^a-z0-9_-]/g, '');

      // Call target peer if no active call established yet
      if (!activeCalls.current[targetUser] && currentPeer) {
        try {
          const call = currentPeer.call(targetPeerId, localStream);
          if (call) {
            activeCalls.current[targetUser] = call;

            call.on('stream', (remoteStream) => {
              setRemoteStreams((prev) => ({
                ...prev,
                [targetUser]: remoteStream,
              }));
            });

            call.on('close', () => {
              setRemoteStreams((prev) => {
                const updated = { ...prev };
                delete updated[targetUser];
                return updated;
              });
              delete activeCalls.current[targetUser];
            });

            call.on('error', () => {
              delete activeCalls.current[targetUser];
            });
          }
        } catch (callErr) {
          console.warn('PeerJS Call Error:', callErr);
        }
      }
    });
  }, [roomState, currentUser?.username, localStream, currentUser]);

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
