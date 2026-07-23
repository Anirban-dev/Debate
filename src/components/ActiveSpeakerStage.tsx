import React, { useEffect, useRef, useState } from 'react';
import { MatchRoomState, Player } from '../types';
import { Video, VideoOff, Mic, MicOff, Volume2, AlertTriangle, Eye, Shield, Sparkles, User, Radio } from 'lucide-react';

interface ActiveSpeakerStageProps {
  roomState: MatchRoomState;
  currentUser: Player | null;
}

export const ActiveSpeakerStage: React.FC<ActiveSpeakerStageProps> = ({
  roomState,
  currentUser
}) => {
  const { timer } = roomState;
  const activePlayer = timer.activePlayerId ? roomState.players[timer.activePlayerId] : null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Initialize browser camera for active player or preview
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (currentUser && !currentUser.isVideoOff && currentUser.username === activePlayer?.username) {
      navigator.mediaDevices?.getUserMedia({ video: true, audio: false })
        .then((stream) => {
          activeStream = stream;
          setLocalStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setCameraError(null);
        })
        .catch((err) => {
          console.warn('Camera access denied or unequipped:', err);
          setCameraError('Camera offline or unavailable');
        });
    } else {
      setLocalStream(null);
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [currentUser?.username, currentUser?.isVideoOff, activePlayer?.username]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 relative overflow-hidden">
      {/* Top Bar for Stage */}
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

      {/* Main Video Box */}
      <div className="relative aspect-video bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center group shadow-inner">
        {activePlayer ? (
          <>
            {/* Live Camera Stream if active player & camera on */}
            {currentUser?.username === activePlayer.username && localStream && !activePlayer.isVideoOff ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              /* Avatar / Video Stage Placeholder for remote/simulated player */
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
                    {activePlayer.isVideoOff ? '📹 Video feed currently paused' : '🎙️ Live Audio Stream Active'}
                  </p>
                </div>
              </div>
            )}

            {/* Stage Overlay Badges */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
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
                <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-800 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 backdrop-blur-md">
                  <Mic className="w-3.5 h-3.5" /> Speaking Live
                </span>
              )}
            </div>

            {/* Turn Countdown Overlay */}
            <div className={`absolute bottom-3 right-3 px-3 py-1.5 rounded-xl border backdrop-blur-md font-mono font-bold text-sm shadow-xl flex items-center gap-2 ${
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
            <p className="text-xs text-slate-600">Admin can select a player from the roster to start speaking turn</p>
          </div>
        )}
      </div>

      {/* Warning Alert Banner inside stage */}
      {timer.isWarningActive && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Finish Time Warning Active! Speaker turn concluding soon.</span>
          </div>
          <span className="font-mono font-bold text-amber-200">{timer.turnTimeRemaining}s left</span>
        </div>
      )}
    </div>
  );
};
