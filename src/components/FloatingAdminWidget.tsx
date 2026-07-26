import React, { useState } from 'react';
import { MatchRoomState, Player } from '@/types';
import { Mic, MicOff, Video, VideoOff, Crown, Volume2, Minimize2, Maximize2 } from 'lucide-react';
import { MediaVideoElement, RemoteAudioElement } from './ActiveSpeakerStage';

interface FloatingAdminWidgetProps {
  roomState: MatchRoomState;
  currentUser: Player | null;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  onToggleMedia: (mediaType: 'mic' | 'video', value: boolean) => void;
  onAdminUpdatePlayer?: (targetUsername: string, updates: Partial<Player>) => void;
}

export const FloatingAdminWidget: React.FC<FloatingAdminWidgetProps> = ({
  roomState,
  currentUser,
  localStream,
  remoteStreams,
  onToggleMedia,
  onAdminUpdatePlayer,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!roomState) return null;

  // Find admin player
  const adminPlayer = Object.values(roomState.players).find(
    (p) => p.role === 'admin' || p.username.toLowerCase() === (roomState.adminUsername || '').toLowerCase()
  );

  if (!adminPlayer) return null;

  const isAdminSelf = !!(
    currentUser &&
    currentUser.username.toLowerCase() === adminPlayer.username.toLowerCase()
  );

  const adminStream = isAdminSelf
    ? localStream
    : remoteStreams[adminPlayer.username.toLowerCase()] || null;

  const handleToggleMic = () => {
    const nextMuted = !adminPlayer.isMuted;
    if (isAdminSelf) {
      onToggleMedia('mic', nextMuted);
    } else if (onAdminUpdatePlayer) {
      onAdminUpdatePlayer(adminPlayer.username, { isMuted: nextMuted });
    }
  };

  const handleToggleVideo = () => {
    const nextVideoOff = !adminPlayer.isVideoOff;
    if (isAdminSelf) {
      onToggleMedia('video', nextVideoOff);
    } else if (onAdminUpdatePlayer) {
      onAdminUpdatePlayer(adminPlayer.username, { isVideoOff: nextVideoOff });
    }
  };

  const isCamOn = !adminPlayer.isVideoOff;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2 max-w-[calc(100vw-2.5rem)] select-none">
      {/* Remote Audio Listener for everyone when admin stream is active & non-self */}
      {!isAdminSelf && adminStream && (
        <RemoteAudioElement stream={adminStream} isMuted={adminPlayer.isMuted} />
      )}

      {/* CASE A: Camera is ON and NOT Minimized -> Render Floating Video Screen */}
      {isCamOn && !isMinimized ? (
        <div className="w-56 sm:w-72 aspect-video rounded-2xl border-2 border-purple-500/90 bg-slate-950 shadow-2xl shadow-purple-950/80 overflow-hidden relative group backdrop-blur-md transition-all">
          {/* Live Video Stream */}
          {adminStream ? (
            <MediaVideoElement
              stream={adminStream}
              isSelf={isAdminSelf}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-purple-950/40">
              <Crown className="w-7 h-7 text-purple-400 animate-bounce mb-1" />
              <span className="text-xs font-bold text-purple-200">@</span>
              <span className="text-[10px] text-purple-300/80">Connecting video feed...</span>
            </div>
          )}

          {/* Overlaid Top Header Bar */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
            <div className="px-2 py-0.5 rounded-full bg-slate-950/85 border border-purple-500/60 text-purple-300 text-[10px] font-bold flex items-center gap-1.5 shadow">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              HOST BROADCAST
            </div>

            <button
              onClick={() => setIsMinimized(true)}
              className="pointer-events-auto p-1 rounded-full bg-slate-950/80 hover:bg-purple-900/80 text-purple-200 border border-purple-500/40 transition shadow"
              title="Minimize Admin Screen"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Overlaid Bottom Info & Quick Controls */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none">
            <div className="px-2 py-1 rounded-lg bg-slate-950/85 border border-slate-800 text-white text-[11px] font-bold truncate flex items-center gap-1 shadow">
              <Crown className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">@{adminPlayer.username}</span>
            </div>

            {/* Quick Admin Self Controls */}
            {isAdminSelf && (
              <div className="pointer-events-auto flex items-center gap-1">
                <button
                  onClick={handleToggleMic}
                  className={`p-1.5 rounded-lg border text-xs font-bold transition shadow ${
                    adminPlayer.isMuted
                      ? 'bg-rose-950 border-rose-600 text-rose-300 hover:bg-rose-900'
                      : 'bg-emerald-950 border-emerald-600 text-emerald-300 hover:bg-emerald-900'
                  }`}
                  title={adminPlayer.isMuted ? 'Unmute My Mic' : 'Mute My Mic'}
                >
                  {adminPlayer.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={handleToggleVideo}
                  className={`p-1.5 rounded-lg border text-xs font-bold transition shadow ${
                    adminPlayer.isVideoOff
                      ? 'bg-rose-950 border-rose-600 text-rose-300 hover:bg-rose-900'
                      : 'bg-purple-950 border-purple-600 text-purple-300 hover:bg-purple-900'
                  }`}
                  title={adminPlayer.isVideoOff ? 'Turn Cam ON' : 'Turn Cam OFF'}
                >
                  {adminPlayer.isVideoOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* CASE B: Camera is OFF or Minimized -> Render Small Floating Badge / Circle */
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-slate-900/95 border-2 border-purple-600/80 shadow-2xl backdrop-blur-md transition-all">
          {/* Admin Avatar Circle */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full border-2 border-purple-400 overflow-hidden bg-purple-950 flex items-center justify-center">
              <img
                src={adminPlayer.avatarUrl}
                alt={adminPlayer.username}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border border-slate-950 flex items-center justify-center text-[9px] text-slate-950 font-black">
              ★
            </span>
          </div>

          {/* Admin Info */}
          <div className="flex flex-col pr-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-purple-200 truncate max-w-[100px]">
                @{adminPlayer.username}
              </span>
              <span className="px-1.5 py-0.2 rounded bg-purple-950 border border-purple-700 text-purple-300 text-[9px] font-black uppercase tracking-wider">
                Host
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
              {!adminPlayer.isMuted ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Volume2 className="w-3 h-3 animate-pulse" /> Mic Open
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-1">
                  <MicOff className="w-3 h-3 text-rose-400" /> Muted
                </span>
              )}
            </div>
          </div>

          {/* Expand Button if minimized when Cam is ON */}
          {isCamOn && isMinimized && (
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1.5 rounded-xl bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-500/50 transition shadow ml-1"
              title="Expand Admin Video Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Admin Controls when Camera is OFF */}
          {isAdminSelf && !isCamOn && (
            <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-800">
              <button
                onClick={handleToggleMic}
                className={`p-2 rounded-xl border text-xs font-bold transition shadow ${
                  adminPlayer.isMuted
                    ? 'bg-rose-950/90 border-rose-600 text-rose-300 hover:bg-rose-900'
                    : 'bg-emerald-950/90 border-emerald-600 text-emerald-300 hover:bg-emerald-900'
                }`}
                title={adminPlayer.isMuted ? 'Unmute My Mic' : 'Mute My Mic'}
              >
                {adminPlayer.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                onClick={handleToggleVideo}
                className={`p-2 rounded-xl border text-xs font-bold transition shadow ${
                  adminPlayer.isVideoOff
                    ? 'bg-purple-950/90 border-purple-600 text-purple-300 hover:bg-purple-900'
                    : 'bg-rose-950/90 border-rose-600 text-rose-300 hover:bg-rose-900'
                }`}
                title={adminPlayer.isVideoOff ? 'Turn Cam ON' : 'Turn Cam OFF'}
              >
                {adminPlayer.isVideoOff ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
