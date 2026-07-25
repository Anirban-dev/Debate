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

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('MediaVideoElement play error:', err);
      });
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isSelf}
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
      playPromise.catch(() => {});
    }
  }, [stream, isMuted]);

  if (!stream) return null;

  return <audio ref={audioRef} autoPlay muted={isMuted} className="hidden" />;
};

// Dedicated Separate Area for Room Admin / Moderator Broadcast & Direct Controls
const AdminStageBox: React.FC<{
  roomState: MatchRoomState;
  currentUser: Player | null;
  localStream?: MediaStream | null;
  remoteStreams?: Record<string, MediaStream>;
  onToggleMedia?: (mediaType: 'mic' | 'video', value: boolean) => void;
  onControlTimer?: (action: "start" | "pause" | "reset" | "switch_turn", extra?: any) => void;
}> = ({ roomState, currentUser, localStream, remoteStreams = {}, onToggleMedia, onControlTimer }) => {
  const adminPlayer = Object.values(roomState.players).find(
    (p) => p.role === 'admin' || p.username.toLowerCase() === (roomState.adminUsername || '').toLowerCase()
  ) || null;

  const isAdminSelf = !!(currentUser && adminPlayer && currentUser.username.toLowerCase() === adminPlayer.username.toLowerCase());
  const adminStream = isAdminSelf ? localStream : (adminPlayer ? remoteStreams[adminPlayer.username.toLowerCase()] : null);

  if (!adminPlayer) return null;

  return (
    <div className="bg-gradient-to-r from-purple-950/90 via-slate-900 to-indigo-950/90 border border-purple-800/70 rounded-2xl p-4 shadow-xl space-y-3 relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-800/50 pb-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-purple-900/80 text-purple-300 border border-purple-700/80">
            <Shield className="w-4 h-4 text-purple-300" />
          </span>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-200 flex items-center gap-2">
              <span>Admin & Moderator Spotlight Area</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-900 text-purple-300 border border-purple-700">
                @{adminPlayer.username}
              </span>
            </h3>
            <p className="text-[11px] text-purple-300/70">
              Dedicated separate broadcast area &bull; Always live during Lobby, Active Match & Paused states
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!adminPlayer.isMuted ? (
            <span className="px-2.5 py-1 rounded-full bg-emerald-950/90 border border-emerald-600 text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Admin Mic Open
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-slate-950 border border-slate-700 text-slate-400 text-xs font-semibold flex items-center gap-1">
              <MicOff className="w-3.5 h-3.5 text-slate-500" />
              Mic Muted
            </span>
          )}

          {!adminPlayer.isVideoOff ? (
            <span className="px-2.5 py-1 rounded-full bg-blue-950/90 border border-blue-600 text-blue-300 text-xs font-bold flex items-center gap-1.5 shadow">
              <Video className="w-3.5 h-3.5 text-blue-400" />
              Video Live
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-slate-950 border border-slate-700 text-slate-400 text-xs font-semibold flex items-center gap-1">
              <VideoOff className="w-3.5 h-3.5 text-slate-500" />
              Cam Off
            </span>
          )}
        </div>
      </div>

      {/* Main Admin Display & Video Area */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* Left: Video / Avatar Box */}
        <div className="sm:col-span-5 relative aspect-video bg-slate-950 rounded-xl border border-purple-900/60 overflow-hidden flex items-center justify-center shadow-inner">
          {/* Remote audio listener for spectators & non-admin participants */}
          {!isAdminSelf && adminStream && (
            <RemoteAudioElement stream={adminStream} isMuted={adminPlayer.isMuted} />
          )}

          {!adminPlayer.isVideoOff && adminStream ? (
            <MediaVideoElement stream={adminStream} isSelf={isAdminSelf} className="w-full h-full object-cover rounded-xl" />
          ) : (
            <div className="flex items-center gap-3 p-3">
              <div className="relative">
                <img
                  src={adminPlayer.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${adminPlayer.username}`}
                  alt={adminPlayer.username}
                  className="w-14 h-14 rounded-full bg-purple-950 border-2 border-purple-500 object-cover"
                />
                {!adminPlayer.isMuted && (
                  <span className="absolute bottom-0 right-0 p-1 bg-emerald-500 text-slate-950 rounded-full shadow">
                    <Radio className="w-3 h-3 animate-pulse" />
                  </span>
                )}
              </div>
              <div>
                <span className="font-bold text-sm text-white block">
                  @{adminPlayer.username}
                </span>
                <span className="text-[10px] text-purple-300 font-medium block">
                  Match Host / Admin
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {adminPlayer.isVideoOff ? '📹 Camera Off' : (adminStream ? '📹 Camera Live' : '📹 Initializing Feed...')} &bull; {adminPlayer.isMuted ? '🎙️ Muted' : '🎙️ Mic Active'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Controls & Host Actions */}
        <div className="sm:col-span-7 space-y-2.5">
          {isAdminSelf ? (
            <div className="space-y-2 bg-slate-950/70 p-3 rounded-xl border border-purple-900/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-200">
                  🎛️ Admin Mic & Video Controls (Active in Lobby & Pause)
                </span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">Host Broadcast</span>
              </div>

              {/* Directly Accessible Mute / Video Toggle Buttons for Admin Himself */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onToggleMedia?.('mic', !currentUser?.isMuted)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border shadow-md ${
                    currentUser?.isMuted
                      ? 'bg-red-900/90 hover:bg-red-800 text-white border-red-600'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                  }`}
                >
                  {currentUser?.isMuted ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      <span>Unmute My Mic</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>Mute My Mic</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleMedia?.('video', !currentUser?.isVideoOff)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border shadow-md ${
                    currentUser?.isVideoOff
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                      : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400'
                  }`}
                >
                  {currentUser?.isVideoOff ? (
                    <>
                      <VideoOff className="w-4 h-4 text-slate-300" />
                      <span>Turn Cam ON</span>
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4" />
                      <span>Turn Cam OFF</span>
                    </>
                  )}
                </button>
              </div>

              {/* Timer & Session Quick Action */}
              {onControlTimer && (
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onControlTimer(roomState.timer.isRunning ? 'pause' : 'start')}
                    className="flex-1 py-1.5 px-3 bg-purple-900/80 hover:bg-purple-800 text-purple-200 font-bold text-xs rounded-lg border border-purple-700 transition flex items-center justify-center gap-1.5"
                  >
                    {roomState.timer.isRunning ? '⏸️ Pause Match' : '▶️ Resume Match'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onControlTimer('switch_turn')}
                    className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-lg border border-slate-700 transition"
                  >
                    ⏭️ Switch Turn
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/60 p-3 rounded-xl border border-purple-900/30 text-xs text-slate-300 space-y-1">
              <p className="font-bold text-purple-200 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                Moderator Broadcast Active
              </p>
              <p className="text-[11px] text-slate-400">
                The Admin can broadcast live announcements and moderate the debate session for all players and spectators, including during lobby & paused states.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
      {/* Dedicated Separate Area for Room Admin / Moderator Broadcast */}
      <AdminStageBox
        roomState={roomState}
        currentUser={currentUser}
        localStream={localStream}
        remoteStreams={remoteStreams}
        onToggleMedia={onToggleMedia}
        onControlTimer={onControlTimer}
      />

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

