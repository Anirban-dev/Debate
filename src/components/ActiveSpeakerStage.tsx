import React, { useEffect, useRef, useState } from 'react';
import { MatchRoomState, Player } from '../types';
import { Video, VideoOff, Mic, MicOff, Volume2, Eye, Radio, Sparkles, User } from 'lucide-react';

interface ActiveSpeakerStageProps {
  roomState: MatchRoomState;
  currentUser: Player | null;
  onToggleMedia?: (mediaType: 'mic' | 'video', value: boolean) => void;
}

export const ActiveSpeakerStage: React.FC<ActiveSpeakerStageProps> = ({
  roomState,
  currentUser,
  onToggleMedia
}) => {
  const { timer } = roomState;
  const activePlayer = timer.activePlayerId ? roomState.players[timer.activePlayerId] : null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);

  // Initialize browser camera & microphone for local user if video or mic is active
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let animationFrameId: number;
    let audioContext: AudioContext | null = null;

    const isSelfActive = currentUser && activePlayer && currentUser.username === activePlayer.username;
    const isSelfVideoOn = currentUser && !currentUser.isVideoOff;
    const isSelfMicOn = currentUser && !currentUser.isMuted;

    if (currentUser && (isSelfVideoOn || isSelfMicOn)) {
      navigator.mediaDevices?.getUserMedia({
        video: !currentUser.isVideoOff,
        audio: !currentUser.isMuted
      })
        .then((stream) => {
          activeStream = stream;
          setLocalStream(stream);

          if (videoRef.current && !currentUser.isVideoOff) {
            videoRef.current.srcObject = stream;
          }

          setMediaError(null);

          // Real-time audio volume visualizer if mic is enabled
          if (!currentUser.isMuted && stream.getAudioTracks().length > 0) {
            try {
              audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
              const analyser = audioContext.createAnalyser();
              const source = audioContext.createMediaStreamSource(stream);
              source.connect(analyser);
              analyser.fftSize = 64;
              const dataArray = new Uint8Array(analyser.frequencyBinCount);

              const updateVolume = () => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                setMicVolumeLevel(Math.min(100, Math.round((average / 128) * 100)));
                animationFrameId = requestAnimationFrame(updateVolume);
              };
              updateVolume();
            } catch (e) {
              // Audio context fallback
            }
          }
        })
        .catch((err) => {
          console.warn('Camera/Mic permission denied:', err);
          setMediaError('Camera/Microphone access pending or unequipped.');
        });
    } else {
      setLocalStream(null);
      setMicVolumeLevel(0);
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [currentUser?.username, currentUser?.isVideoOff, currentUser?.isMuted, activePlayer?.username]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
            Active Speaker Spotlight
          </span>
        </div>

        {currentUser?.role === 'spectator' && (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            <Eye className="w-3.5 h-3.5" /> Spectator View Mode
          </span>
        )}
      </div>

      {/* Main Stage View Box */}
      <div className="relative aspect-video bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center group shadow-inner">
        {activePlayer ? (
          <>
            {/* Real Camera Stream if local user is active speaker with camera ON */}
            {currentUser?.username === activePlayer.username && localStream && !activePlayer.isVideoOff ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover rounded-xl transform -scale-x-100"
              />
            ) : !activePlayer.isVideoOff ? (
              /* Simulated Remote Live Video Feed with Active Canvas */
              <div className="w-full h-full relative flex items-center justify-center bg-slate-900/90">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent"></div>
                <div className="relative text-center space-y-3 z-10 p-4">
                  <div className={`relative inline-block p-1 rounded-full border-2 ${
                    activePlayer.team === 'team1' ? 'border-blue-500 shadow-lg shadow-blue-900/50' : 'border-red-500 shadow-lg shadow-red-900/50'
                  }`}>
                    <img
                      src={activePlayer.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${activePlayer.username}`}
                      alt={activePlayer.username}
                      className="w-24 h-24 rounded-full bg-slate-800 object-cover"
                    />
                    <span className="absolute bottom-1 right-1 p-1.5 bg-emerald-500 text-slate-950 rounded-full shadow">
                      <Video className="w-4 h-4 animate-pulse" />
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-lg text-white font-mono block">
                      @{activePlayer.username}
                    </span>
                    <span className="text-xs text-blue-400 font-semibold">Live Webcam Stream Active</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Avatar Placeholder if camera is OFF */
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className={`relative p-1 rounded-full border-2 ${
                  activePlayer.team === 'team1' ? 'border-blue-500 shadow-lg shadow-blue-900/50' : 'border-red-500 shadow-lg shadow-red-900/50'
                }`}>
                  <img
                    src={activePlayer.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${activePlayer.username}`}
                    alt={activePlayer.username}
                    className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-slate-800 object-cover"
                  />
                  {!activePlayer.isMuted && (
                    <span className="absolute bottom-1 right-1 p-1.5 bg-emerald-500 text-slate-950 rounded-full shadow">
                      <Radio className="w-4 h-4 animate-pulse" />
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-bold text-lg text-white font-mono">
                      @{activePlayer.username}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                      activePlayer.team === 'team1' ? 'bg-blue-900 text-blue-200' : 'bg-red-900 text-red-200'
                    }`}>
                      {activePlayer.team === 'team1' ? 'Team 1' : 'Team 2'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    📹 Camera Off &bull; 🎙️ Voice Stream Active
                  </p>
                </div>
              </div>
            )}

            {/* Stage Overlay Badges */}
            <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase backdrop-blur-md shadow border ${
                activePlayer.team === 'team1'
                  ? 'bg-blue-950/80 border-blue-600/80 text-blue-200'
                  : 'bg-red-950/80 border-red-600/80 text-red-200'
              }`}>
                @{activePlayer.username}
              </span>

              {activePlayer.isMuted ? (
                <span className="bg-red-950/90 text-red-300 border border-red-800 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 backdrop-blur-md">
                  <MicOff className="w-3.5 h-3.5" /> Muted
                </span>
              ) : (
                <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-800 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 backdrop-blur-md">
                  <Mic className="w-3.5 h-3.5" /> Live Audio
                  {/* Real-time mic volume level bar if local user */}
                  {currentUser?.username === activePlayer.username && (
                    <span className="w-12 h-2 bg-slate-800 rounded-full overflow-hidden border border-emerald-600 inline-block">
                      <span
                        className="h-full bg-emerald-400 block transition-all duration-75"
                        style={{ width: `${micVolumeLevel}%` }}
                      ></span>
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Turn Timer Badge */}
            <div className={`absolute bottom-3 right-3 px-3 py-1.5 rounded-xl border backdrop-blur-md font-mono font-bold text-sm shadow-xl flex items-center gap-2 z-20 ${
              timer.isWarningActive
                ? 'bg-amber-950/90 border-amber-500 text-amber-300 animate-pulse'
                : 'bg-slate-950/90 border-slate-700 text-white'
            }`}>
              <span>{Math.floor(timer.turnTimeRemaining / 60)}:{(timer.turnTimeRemaining % 60).toString().padStart(2, '0')}</span>
            </div>
          </>
        ) : (
          <div className="text-center p-6 text-slate-500 space-y-2">
            <User className="w-12 h-12 mx-auto text-slate-700" />
            <p className="text-sm font-medium">No active speaker selected</p>
            <p className="text-xs text-slate-600">Admin can click on any player to feature them on the speaker stage</p>
          </div>
        )}
      </div>

      {mediaError && (
        <p className="text-xs text-amber-400 bg-amber-950/50 p-2 rounded-lg border border-amber-800/80">
          ⚠️ {mediaError}
        </p>
      )}
    </div>
  );
};
