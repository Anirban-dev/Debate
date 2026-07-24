import React, { useEffect, useRef, useState } from 'react';
import { MatchRoomState, Player } from '../types';
import { Video, VideoOff, Mic, MicOff, Eye, Radio, Volume2 } from 'lucide-react';

interface ActiveSpeakerStageProps {
  roomState: MatchRoomState;
  currentUser: Player | null;
  onToggleMedia?: (mediaType: 'mic' | 'video', value: boolean) => void;
  onControlTimer?: (action: "start" | "pause" | "reset" | "switch_turn", extra?: any) => void;
}

export const ActiveSpeakerStage: React.FC<ActiveSpeakerStageProps> = ({
  roomState,
  currentUser,
  onToggleMedia,
  onControlTimer
}) => {
  const isMatchRunning = timer.isRunning || roomState.status === 'running' || roomState.status === 'paused';
  const activePlayer = (isMatchRunning && timer.activePlayerId) ? roomState.players[timer.activePlayerId] : null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);

  // Initialize browser camera & microphone for local user if video or mic is active
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let animationFrameId: number;
    let audioContext: AudioContext | null = null;

    const isSelfPlayer = currentUser && currentUser.role === 'player';
    const isSelfVideoOn = isSelfPlayer && !currentUser.isVideoOff;
    const isSelfMicOn = isSelfPlayer && !currentUser.isMuted;

    if (currentUser && isSelfPlayer && (isSelfVideoOn || isSelfMicOn)) {
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
        .catch(() => {
          // Camera/Mic permission fallback
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
  }, [currentUser?.username, currentUser?.isVideoOff, currentUser?.isMuted, currentUser?.role]);

  // Simulated live video canvas generator for remote active speakers with camera ON
  useEffect(() => {
    if (!activePlayer || activePlayer.isVideoOff) return;
    if (currentUser?.username === activePlayer.username && localStream) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let step = 0;

    const renderWave = () => {
      step += 0.05;
      const width = canvas.width;
      const height = canvas.height;

      // Dark futuristic video backdrop
      ctx.fillStyle = activePlayer.team === 'team1' ? '#0f172a' : '#1e1115';
      ctx.fillRect(0, 0, width, height);

      // Subtle video grid lines
      ctx.strokeStyle = activePlayer.team === 'team1' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Audio wave spectrum line
      ctx.strokeStyle = activePlayer.team === 'team1' ? '#3b82f6' : '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();

      const sliceWidth = width / 50;
      let x = 0;

      for (let i = 0; i < 50; i++) {
        const v = Math.sin(step + i * 0.2) * (activePlayer.isMuted ? 5 : 25);
        const y = height / 2 + v;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.stroke();
      animationId = requestAnimationFrame(renderWave);
    };

    renderWave();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [activePlayer?.username, activePlayer?.isVideoOff, activePlayer?.isMuted, localStream, currentUser?.username]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 relative overflow-hidden">
      {/* Top Header & Lobby Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              timer.isRunning ? 'bg-red-400' : 'bg-amber-400'
            }`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              timer.isRunning ? 'bg-red-500' : 'bg-amber-500'
            }`}></span>
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
            Active Speaker Spotlight Stage
          </span>
          {!timer.isRunning && (
            <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800/80 px-2 py-0.5 rounded-full font-bold">
              Match Lobby (Paused)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentUser?.role === 'admin' && !timer.isRunning && onControlTimer && (
            <button
              onClick={() => onControlTimer('start')}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-lg shadow-md shadow-emerald-950/60 transition flex items-center gap-1.5 animate-pulse"
            >
              🚀 Start Debate Session
            </button>
          )}

          {currentUser?.role === 'spectator' && (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
              <Eye className="w-3.5 h-3.5" /> Spectator Lounge Mode
            </span>
          )}
        </div>
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
              /* Animated Video Stream Canvas for active video player */
              <div className="w-full h-full relative flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={360}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>

                <div className="absolute center text-center space-y-2 z-10 p-4">
                  <div className={`relative inline-block p-1 rounded-full border-2 ${
                    activePlayer.team === 'team1' ? 'border-blue-500 shadow-lg shadow-blue-900/50' : 'border-red-500 shadow-lg shadow-red-900/50'
                  }`}>
                    <img
                      src={activePlayer.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${activePlayer.username}`}
                      alt={activePlayer.username}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-800 object-cover"
                    />
                    <span className="absolute bottom-1 right-1 p-1.5 bg-emerald-500 text-slate-950 rounded-full shadow">
                      <Video className="w-4 h-4 animate-pulse" />
                    </span>
                  </div>

                  <div>
                    <span className="font-bold text-base sm:text-lg text-white font-mono block">
                      @{activePlayer.username}
                    </span>
                    <span className="text-xs text-blue-400 font-semibold flex items-center justify-center gap-1">
                      <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Live Video Stream Active
                    </span>
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

              {!activePlayer.isMuted ? (
                <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-600/80 text-emerald-300 rounded-lg text-xs font-semibold backdrop-blur-md flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Speaking
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-red-950/80 border border-red-600/80 text-red-300 rounded-lg text-xs font-semibold backdrop-blur-md flex items-center gap-1">
                  <MicOff className="w-3.5 h-3.5" /> Muted
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="text-center p-6 space-y-2">
            <Video className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-xs">Stage Idle &bull; Waiting for active speaker turn</p>
          </div>
        )}
      </div>

      {/* Mic Audio Level Visualizer Bar if user is active speaker */}
      {currentUser && activePlayer && currentUser.username === activePlayer.username && !currentUser.isMuted && (
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center gap-3">
          <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex-1 bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-emerald-500 h-full transition-all duration-75"
              style={{ width: `${micVolumeLevel}%` }}
            ></div>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">{micVolumeLevel}%</span>
        </div>
      )}
    </div>
  );
};
