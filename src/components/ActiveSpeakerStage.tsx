import React, { useEffect, useRef, useState } from 'react';
import { MatchRoomState, Player } from '../types';
import { Video, VideoOff, Mic, MicOff, Eye, Radio, Volume2 } from 'lucide-react';

interface ActiveSpeakerStageProps {
  roomState: MatchRoomState;
  currentUser: Player | null;
  localStream?: MediaStream | null;
  remoteStreams?: Record<string, MediaStream>;
  onToggleMedia?: (mediaType: 'mic' | 'video', value: boolean) => void;
  onControlTimer?: (action: "start" | "pause" | "reset" | "switch_turn", extra?: any) => void;
}

export const ActiveSpeakerStage: React.FC<ActiveSpeakerStageProps> = ({
  roomState,
  currentUser,
  localStream,
  remoteStreams = {},
  onToggleMedia,
  onControlTimer
}) => {
  const timer = roomState?.timer;
  const isMatchRunning = roomState?.status === 'running' || roomState?.status === 'paused';
  const activePlayer = (isMatchRunning && timer?.activePlayerId) ? roomState.players[timer.activePlayerId] : null;

  const stageVideoRef = useRef<HTMLVideoElement | null>(null);
  const stageAudioRef = useRef<HTMLAudioElement | null>(null);

  const isSelfActive = !!(currentUser && activePlayer && currentUser.username.toLowerCase() === activePlayer.username.toLowerCase());
  const activeStream = isSelfActive ? localStream : (activePlayer ? remoteStreams[activePlayer.username.toLowerCase()] : null);

  useEffect(() => {
    if (stageVideoRef.current && activeStream && activePlayer && !activePlayer.isVideoOff) {
      stageVideoRef.current.srcObject = activeStream;
    }
  }, [activeStream, activePlayer?.isVideoOff, activePlayer]);

  useEffect(() => {
    if (stageAudioRef.current && activeStream && !isSelfActive) {
      stageAudioRef.current.srcObject = activeStream;
    }
  }, [activeStream, isSelfActive]);

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

      {/* Main Stage View Box or Pre-Match Turn Order List */}
      {isMatchRunning ? (
        <div className="relative aspect-video bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center group shadow-inner">
          {activePlayer ? (
            <>
              {/* Hidden audio element for remote active speaker voice audio */}
              {!isSelfActive && activeStream && (
                <audio
                  ref={stageAudioRef}
                  autoPlay
                  muted={activePlayer.isMuted}
                  className="hidden"
                />
              )}

              {/* Real Camera Stream if active speaker has camera ON */}
              {!activePlayer.isVideoOff && activeStream ? (
                <video
                  ref={stageVideoRef}
                  autoPlay
                  playsInline
                  muted={isSelfActive}
                  className={`w-full h-full object-cover rounded-xl ${isSelfActive ? 'transform -scale-x-100' : ''}`}
                />
              ) : (
                /* Avatar Placeholder if camera is OFF or stream connecting */
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
      ) : (
        /* Pre-match Lobby Stage: Scheduled Turn Order Sequence */
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div>
              <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                <span>📋 Scheduled Speaking Order</span>
                <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded font-mono">
                  Alternating Order
                </span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Match has not started yet. When started by Host Admin, speakers will take the stage in this order.
              </p>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {roomState.registeredRoster && roomState.registeredRoster.length > 0 ? (
              roomState.registeredRoster.map((player, idx) => (
                <div
                  key={player.username}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                    player.team === 'team1'
                      ? 'bg-blue-950/30 border-blue-800/50 text-blue-200'
                      : 'bg-red-950/30 border-red-800/50 text-red-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 font-mono font-bold flex items-center justify-center text-[11px]">
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-white font-mono">@{player.username}</span>
                      <span className="text-[10px] opacity-75 font-mono block">
                        {player.team === 'team1' ? 'Team 1 (Blue)' : 'Team 2 (Red)'}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                    ⏱️ {player.personalizedTime || 180}s turn
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs italic">
                No players assigned to turn order yet. Host Admin can set roster in Admin Control Suite.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
