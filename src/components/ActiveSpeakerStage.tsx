import React, { useEffect, useRef } from 'react';
import { MatchRoomState, Player } from '../types';
import { Video, VideoOff, Mic, MicOff, Eye, Radio, Volume2, Shield } from 'lucide-react';

interface ActiveSpeakerStageProps {
  roomState: MatchRoomState;
  currentUser: Player | null;
  localStream?: MediaStream | null;
  remoteStreams?: Record<string, MediaStream>;
  onToggleMedia?: (mediaType: 'mic' | 'video', value: boolean) => void;
  onControlTimer?: (action: "start" | "pause" | "reset" | "switch_turn", extra?: any) => void;
  onAdminUpdatePlayer?: (targetUsername: string, updates: Partial<Player>) => void;
}

// Bulletproof Helper Component for Video Stream Playback
export const MediaVideoElement: React.FC<{
  stream: MediaStream | null | undefined;
  isSelf?: boolean;
  className?: string;
}> = ({ stream, isSelf, className = "w-full h-full object-cover" }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    const attemptPlay = () => {
      if (video && video.paused) {
        video.play().catch((err) => {
          console.warn('MediaVideoElement play error:', err);
        });
      }
    };

    video.addEventListener('loadedmetadata', attemptPlay);
    video.addEventListener('loadeddata', attemptPlay);
    video.addEventListener('canplay', attemptPlay);

    attemptPlay();

    const handleTrackChange = () => {
      if (video) {
        video.srcObject = new MediaStream(stream.getTracks());
        attemptPlay();
      }
    };

    stream.addEventListener('addtrack', handleTrackChange);
    stream.addEventListener('removetrack', handleTrackChange);

    return () => {
      video.removeEventListener('loadedmetadata', attemptPlay);
      video.removeEventListener('loadeddata', attemptPlay);
      video.removeEventListener('canplay', attemptPlay);
      stream.removeEventListener('addtrack', handleTrackChange);
      stream.removeEventListener('removetrack', handleTrackChange);
    };
  }, [stream]);

  if (!stream) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={true}
      className={`${className} ${isSelf ? 'transform -scale-x-100' : ''}`}
    />
  );
};

// Bulletproof Helper Component for Remote Audio Stream Playback
export const RemoteAudioElement: React.FC<{
  stream: MediaStream | null | undefined;
  isMuted?: boolean;
}> = ({ stream, isMuted }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !stream) return;

    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }

    audio.muted = !!isMuted;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('RemoteAudioElement play prevented, waiting for user interaction:', err);
      });
    }
  }, [stream, isMuted]);

  useEffect(() => {
    const handleGesture = () => {
      const audio = audioRef.current;
      if (audio && audio.paused && !isMuted) {
        audio.play().catch(() => {});
      }
    };

    window.addEventListener('click', handleGesture, { once: false });
    window.addEventListener('keydown', handleGesture, { once: false });

    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, [isMuted]);

  if (!stream) return null;

  return <audio ref={audioRef} autoPlay muted={isMuted} className="hidden" />;
};

export const ActiveSpeakerStage: React.FC<ActiveSpeakerStageProps> = ({
  roomState,
  currentUser,
  localStream = null,
  remoteStreams = {},
  onToggleMedia,
  onControlTimer,
  onAdminUpdatePlayer
}) => {
  const timer = roomState?.timer;
  
  // Check if sequence is finished
  const roster = roomState.registeredRoster || [];
  const spokeList = roomState.spokeUsernames || [];
  const isSequenceFinished = roomState.isSequenceFinished || (roster.length > 0 && roster.every(r => spokeList.includes(r.username.toLowerCase())));
  
  // Always determine activePlayer (whether match is running, paused, or pre-match lobby)
  const activePlayer = (timer?.activePlayerId && roomState.players[timer.activePlayerId])
    ? roomState.players[timer.activePlayerId]
    : (roomState.registeredRoster?.[0] && roomState.players[roomState.registeredRoster[0].username]
        ? roomState.players[roomState.registeredRoster[0].username]
        : (Object.values(roomState.players).find(p => p.role === 'player') || null));

  const stageVideoRef = useRef<HTMLVideoElement | null>(null);
  const stageAudioRef = useRef<HTMLAudioElement | null>(null);

  const isSelfActive = !!(currentUser && activePlayer && currentUser.username.toLowerCase() === activePlayer.username.toLowerCase());
  const activeStream = isSelfActive ? localStream : (activePlayer ? remoteStreams[activePlayer.username.toLowerCase()] : null);

  useEffect(() => {
    if (stageVideoRef.current && activeStream && activePlayer && !activePlayer.isVideoOff) {
      if (stageVideoRef.current.srcObject !== activeStream) {
        stageVideoRef.current.srcObject = activeStream;
      }
      stageVideoRef.current.play().catch(() => {});
    }
  }, [activeStream, activePlayer?.isVideoOff, activePlayer?.username, activePlayer]);

  useEffect(() => {
    if (stageAudioRef.current && activeStream && !isSelfActive) {
      if (stageAudioRef.current.srcObject !== activeStream) {
        stageAudioRef.current.srcObject = activeStream;
      }
      stageAudioRef.current.play().catch(() => {});
    }
  }, [activeStream, isSelfActive, activePlayer?.username]);

  return (
    <div className="space-y-4">
      {/* Sequence Finished / Re-queue Banner */}
      {isSequenceFinished && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-purple-950 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <h3 className="text-sm font-extrabold text-emerald-300 uppercase tracking-wide">
                Sequence Completed — All Speakers Have Finished
              </h3>
            </div>
            <p className="text-xs text-slate-300">
              All registered players in the speaking queue have completed their turns.
            </p>
          </div>

          {currentUser?.role === 'admin' && onControlTimer && (
            <button
              onClick={() => onControlTimer('requeue')}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-950/80 transition flex items-center gap-2 shrink-0 animate-bounce"
            >
              🔄 Re-queue All & Start Again
            </button>
          )}
        </div>
      )}

      {/* Main Active Debater Spotlight Stage */}
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

        {/* Active Speaker Stage Spotlight Video Container */}
        <div className="relative aspect-video bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center group shadow-inner">
          {activePlayer ? (
            <>
              {/* Hidden audio element for remote active speaker voice audio */}
              {!isSelfActive && activeStream && (
                <RemoteAudioElement stream={activeStream} isMuted={activePlayer.isMuted} />
              )}

              {/* Real Camera Stream if active speaker has camera ON */}
              {!activePlayer.isVideoOff && activeStream ? (
                <MediaVideoElement stream={activeStream} isSelf={isSelfActive} className="w-full h-full object-cover rounded-xl" />
              ) : (
                /* Avatar Placeholder if camera is OFF or stream connecting */
                <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
                  <div className={`relative p-1 rounded-full border-2 ${
                    activePlayer.team === 'team1' ? 'border-blue-500 shadow-lg shadow-blue-900/50' : 'border-red-500 shadow-lg shadow-red-900/50'
                  }`}>
                    <img
                      src={activePlayer.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${activePlayer.username}`}
                      alt={activePlayer.username}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-800 object-cover"
                    />
                    {!activePlayer.isMuted && (
                      <span className="absolute bottom-0 right-0 p-1 bg-emerald-500 text-slate-950 rounded-full shadow">
                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-bold text-base text-white font-mono">
                        @{activePlayer.username}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        activePlayer.team === 'team1' ? 'bg-blue-900 text-blue-200' : 'bg-red-900 text-red-200'
                      }`}>
                        {activePlayer.team === 'team1' ? 'Team 1' : 'Team 2'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {activePlayer.isVideoOff ? '📹 Camera Off' : (activeStream ? '📹 Camera Live' : '📹 Initializing Feed...')} &bull; {activePlayer.isMuted ? '🎙️ Muted' : '🎙️ Voice Active'}
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

                {!timer.isRunning ? (
                  <span className="px-2.5 py-1 bg-amber-950/90 border border-amber-500/80 text-amber-300 rounded-lg text-xs font-bold backdrop-blur-md flex items-center gap-1.5 shadow">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    ⏸️ Not Speaking (Standby)
                  </span>
                ) : !activePlayer.isMuted ? (
                  <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-600/80 text-emerald-300 rounded-lg text-xs font-semibold backdrop-blur-md flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Speaking Live
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-red-950/80 border border-red-600/80 text-red-300 rounded-lg text-xs font-semibold backdrop-blur-md flex items-center gap-1">
                    <MicOff className="w-3.5 h-3.5" /> Muted
                  </span>
                )}
              </div>

              {/* Admin Speaker Stage Direct Control Permissions (Only allowed while player is on stage) */}
              {currentUser?.role === 'admin' && onAdminUpdatePlayer && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
                  <button
                    type="button"
                    onClick={() => onAdminUpdatePlayer(activePlayer.username, { isMutedByAdmin: !activePlayer.isMutedByAdmin, isMuted: !activePlayer.isMutedByAdmin })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 backdrop-blur-md border ${
                      activePlayer.isMutedByAdmin || activePlayer.isMuted
                        ? 'bg-red-900/90 text-white border-red-500 shadow'
                        : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800'
                    }`}
                    title={activePlayer.isMutedByAdmin ? "Unmute Active Speaker (Admin)" : "Mute Active Speaker (Admin)"}
                  >
                    {activePlayer.isMutedByAdmin || activePlayer.isMuted ? <MicOff className="w-3.5 h-3.5 text-red-300" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>{activePlayer.isMutedByAdmin ? 'Muted (Admin)' : 'Admin Mute'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onAdminUpdatePlayer(activePlayer.username, { isVideoOffByAdmin: !activePlayer.isVideoOffByAdmin, isVideoOff: !activePlayer.isVideoOffByAdmin })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 backdrop-blur-md border ${
                      activePlayer.isVideoOffByAdmin || activePlayer.isVideoOff
                        ? 'bg-amber-900/90 text-white border-amber-500 shadow'
                        : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800'
                    }`}
                    title={activePlayer.isVideoOffByAdmin ? "Enable Active Speaker Camera (Admin)" : "Disable Active Speaker Camera (Admin)"}
                  >
                    {activePlayer.isVideoOffByAdmin || activePlayer.isVideoOff ? <VideoOff className="w-3.5 h-3.5 text-amber-300" /> : <Video className="w-3.5 h-3.5 text-blue-400" />}
                    <span>{activePlayer.isVideoOffByAdmin ? 'Camera Off (Admin)' : 'Admin Camera'}</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center p-6 space-y-2">
              <Video className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-slate-400 text-xs">Stage Ready &bull; Waiting for active speaker turn</p>
            </div>
          )}
        </div>

        {/* Scheduled Speaking Order List Below Active Video Box */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <h4 className="font-extrabold text-xs text-white flex items-center gap-2">
              <span>📋 Scheduled Speaking Order</span>
              <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded font-mono">
                Alternating Sequence
              </span>
            </h4>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {roomState.registeredRoster && roomState.registeredRoster.length > 0 ? (
              roomState.registeredRoster.map((player, idx) => {
                const isTurnActive = activePlayer && activePlayer.username.toLowerCase() === player.username.toLowerCase();
                return (
                  <div
                    key={player.username}
                    className={`p-2 rounded-xl border flex items-center justify-between text-xs transition ${
                      isTurnActive
                        ? 'bg-amber-950/60 border-amber-500 text-amber-200 font-bold shadow-sm'
                        : player.team === 'team1'
                        ? 'bg-blue-950/30 border-blue-800/50 text-blue-200'
                        : 'bg-red-950/30 border-red-800/50 text-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-md font-mono font-bold flex items-center justify-center text-[10px] ${
                        isTurnActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                      }`}>
                        #{idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-white font-mono">@{player.username}</span>
                        <span className="text-[10px] opacity-75 font-mono block">
                          {player.team === 'team1' ? 'Team 1 (Blue)' : 'Team 2 (Red)'}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                      ⏱️ {player.personalizedTime || 180}s turn
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4 text-slate-500 text-xs italic">
                No players assigned to turn order yet. Host Admin can set roster in Admin Control Suite.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

