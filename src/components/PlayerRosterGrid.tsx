import React, { useEffect, useRef, useState } from 'react';
import { MatchRoomState, Player, TeamId } from '../types';
import { Mic, MicOff, Video, VideoOff, Volume2, Shield, Clock, UserX, Ban, Edit2, Check, X, ArrowRightLeft } from 'lucide-react';

interface PlayerRosterGridProps {
  roomState: MatchRoomState;
  currentUser: Player | null;
  onToggleMedia: (mediaType: 'mic' | 'video', value: boolean) => void;
  onAdminUpdatePlayer?: (targetUsername: string, updates: Partial<Player>) => void;
  onAdminKickUser?: (targetUsername: string) => void;
  onAdminBanUser?: (targetUsername: string) => void;
  onUpdateTeamTime?: (team: TeamId, newTimeSeconds: number) => void;
  onUpdatePlayerTime?: (username: string, newTimeSeconds: number) => void;
}

// Sub-component for rendering individual player webcam video preview
const LocalWebcamPreview: React.FC<{ isVideoOff: boolean }> = ({ isVideoOff }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (!isVideoOff) {
      navigator.mediaDevices?.getUserMedia({ video: true })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(() => {});
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isVideoOff]);

  if (isVideoOff) return null;

  return (
    <div className="w-12 h-12 rounded-xl overflow-hidden bg-black shrink-0 border border-blue-500 shadow-md">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover transform -scale-x-100"
      />
    </div>
  );
};

export const PlayerRosterGrid: React.FC<PlayerRosterGridProps> = ({
  roomState,
  currentUser,
  onToggleMedia,
  onAdminUpdatePlayer,
  onAdminKickUser,
  onAdminBanUser,
  onUpdateTeamTime,
  onUpdatePlayerTime
}) => {
  const { players, timer } = roomState;

  // Edit team time inline state
  const [editingTeam, setEditingTeam] = useState<TeamId | null>(null);
  const [teamTimeMinutesInput, setTeamTimeMinutesInput] = useState<number>(5);

  // Edit individual player time inline state (Only for self)
  const [editingPlayerTime, setEditingPlayerTime] = useState<boolean>(false);
  const [playerTimeInput, setPlayerTimeInput] = useState<number>(100);

  const team1Players = (Object.values(players) as Player[]).filter(p => p.role === 'player' && p.team === 'team1');
  const team2Players = (Object.values(players) as Player[]).filter(p => p.role === 'player' && p.team === 'team2');

  const isSessionRunning = timer.isRunning;

  const handleStartTeamTimeEdit = (team: TeamId) => {
    if (isSessionRunning) {
      alert("⚠️ Debate session is active! Admin must pause the debate session first before modifying team time.");
      return;
    }
    const totalSecs = team === 'team1' ? (roomState.team1TotalTime || 300) : (roomState.team2TotalTime || 300);
    setTeamTimeMinutesInput(Math.ceil(totalSecs / 60));
    setEditingTeam(team);
  };

  const handleSaveTeamTime = (team: TeamId) => {
    if (onUpdateTeamTime && teamTimeMinutesInput > 0) {
      onUpdateTeamTime(team, teamTimeMinutesInput * 60);
    }
    setEditingTeam(null);
  };

  const handleSavePlayerTime = (username: string) => {
    if (onUpdatePlayerTime && playerTimeInput > 0) {
      onUpdatePlayerTime(username, playerTimeInput);
    }
    setEditingPlayerTime(false);
  };

  const renderPlayerCard = (player: Player) => {
    const isSelf = currentUser?.username === player.username;
    const isSelfTeam = currentUser?.role === 'player' && currentUser.team === player.team;
    const isActiveSpeaker = timer.activePlayerId === player.username;
    const isAdmin = currentUser?.role === 'admin';

    return (
      <div
        key={player.username}
        className={`relative p-3 rounded-2xl border transition-all ${
          isActiveSpeaker
            ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-900/30 ring-2 ring-amber-500/50 scale-[1.01]'
            : isSelfTeam
            ? player.team === 'team1'
              ? 'bg-blue-950/40 border-blue-500/70 shadow-md shadow-blue-950/40'
              : 'bg-red-950/40 border-red-500/70 shadow-md shadow-red-950/40'
            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Active Speaker Animated Ring */}
        {isActiveSpeaker && (
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shadow flex items-center gap-1 z-10 animate-bounce">
            <Volume2 className="w-3 h-3 animate-pulse" /> Active Speaker
          </div>
        )}

        {/* Self Team Badge */}
        {isSelfTeam && !isActiveSpeaker && (
          <div className={`absolute -top-2 left-3 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
            player.team === 'team1' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
          }`}>
            Your Team
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
          {/* Avatar / Camera Preview & Player Meta */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Local Webcam Preview or Remote Video Avatar */}
            {isSelf && !player.isVideoOff ? (
              <LocalWebcamPreview isVideoOff={player.isVideoOff} />
            ) : !player.isVideoOff ? (
              <div className="relative shrink-0 w-12 h-12 rounded-xl bg-slate-950 border border-blue-500/80 flex items-center justify-center overflow-hidden">
                <img
                  src={player.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.username}`}
                  alt={player.username}
                  className="w-full h-full object-cover opacity-90"
                />
                <span className="absolute bottom-0 right-0 p-1 bg-blue-600 text-white rounded-tl-md text-[8px] font-bold">
                  CAM
                </span>
              </div>
            ) : (
              <div className="relative shrink-0">
                <img
                  src={player.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.username}`}
                  alt={player.username}
                  className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 object-cover"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 bg-emerald-500"></span>
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs sm:text-sm text-white truncate font-mono">
                  @{player.username}
                </span>
                {isSelf && (
                  <span className="text-[10px] bg-blue-900/60 text-blue-200 border border-blue-800 px-1.5 py-0.2 rounded font-sans font-semibold">
                    You
                  </span>
                )}
              </div>

              {/* Individual Time Share & Personal Adjustment (Only editable by self, NOT by admin) */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                {isSelf && editingPlayerTime ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={5}
                      max={1800}
                      value={playerTimeInput}
                      onChange={(e) => setPlayerTimeInput(Number(e.target.value))}
                      className="w-14 bg-slate-950 border border-blue-500 rounded px-1 text-[11px] text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-400">s</span>
                    <button
                      onClick={() => handleSavePlayerTime(player.username)}
                      className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500"
                      title="Save My Time"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setEditingPlayerTime(false)}
                      className="p-1 bg-slate-800 text-slate-400 rounded hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 font-mono">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-slate-200 font-semibold">{player.remainingSeconds}s</span>
                    {player.remainingSeconds <= 0 ? (
                      <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-1 py-0.2 rounded font-sans font-bold">
                        Spoken
                      </span>
                    ) : isSelf && (
                      <button
                        onClick={() => {
                          if (isSessionRunning) {
                            alert("⚠️ Debate session is active! Session must be paused before adjusting personal time.");
                            return;
                          }
                          setPlayerTimeInput(player.timeLimitSeconds || 100);
                          setEditingPlayerTime(true);
                        }}
                        className="text-blue-400 hover:text-blue-300 p-0.5 rounded transition"
                        title={isSessionRunning ? "Pause session to adjust time" : "Adjust My Personal Time Allocation"}
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                )}

                {player.isMutedByAdmin && (
                  <span className="text-red-400 font-semibold text-[10px]">Admin Muted</span>
                )}
              </div>
            </div>
          </div>

          {/* Controls & Direct Admin Power on Tile */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mic Toggle Button */}
            {isSelf ? (
              <button
                onClick={() => onToggleMedia('mic', !player.isMuted)}
                disabled={player.isMutedByAdmin}
                className={`p-1.5 rounded-lg transition font-semibold text-xs flex items-center gap-1 ${
                  player.isMuted
                    ? 'bg-red-950/80 text-red-400 border border-red-800/80'
                    : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 hover:bg-emerald-900/80 shadow'
                }`}
                title={player.isMutedByAdmin ? 'Muted by Admin' : player.isMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {player.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <div className={`p-1.5 rounded-lg border ${
                player.isMuted ? 'bg-slate-900 border-slate-800 text-red-400' : 'bg-slate-900 border-slate-800 text-emerald-400'
              }`}>
                {player.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </div>
            )}

            {/* Camera Toggle Button */}
            {isSelf ? (
              <button
                onClick={() => onToggleMedia('video', !player.isVideoOff)}
                disabled={player.isVideoOffByAdmin}
                className={`p-1.5 rounded-lg transition font-semibold text-xs flex items-center gap-1 ${
                  player.isVideoOff
                    ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                    : 'bg-blue-600 text-white border border-blue-500 shadow hover:bg-blue-500'
                }`}
                title={player.isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
              >
                {player.isVideoOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <div className={`p-1.5 rounded-lg border ${
                player.isVideoOff ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-slate-900 border-slate-800 text-blue-400'
              }`}>
                {player.isVideoOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              </div>
            )}

            {/* Direct Admin Controls Directly on Player Tile */}
            {isAdmin && onAdminUpdatePlayer && (
              <div className="flex items-center gap-1 ml-1 pl-1 border-l border-slate-800">
                {/* Admin Mute Toggle */}
                <button
                  onClick={() => onAdminUpdatePlayer(player.username, { isMutedByAdmin: !player.isMutedByAdmin })}
                  className={`p-1.5 rounded-lg transition ${
                    player.isMutedByAdmin ? 'bg-purple-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title={player.isMutedByAdmin ? 'Unmute Player (Admin)' : 'Mute Player (Admin)'}
                >
                  <Shield className="w-3.5 h-3.5" />
                </button>

                {/* Admin Disable Camera Toggle */}
                <button
                  onClick={() => onAdminUpdatePlayer(player.username, { isVideoOffByAdmin: !player.isVideoOffByAdmin })}
                  className={`p-1.5 rounded-lg transition ${
                    player.isVideoOffByAdmin ? 'bg-amber-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title={player.isVideoOffByAdmin ? 'Enable Player Camera (Admin)' : 'Disable Player Camera (Admin)'}
                >
                  <VideoOff className="w-3.5 h-3.5" />
                </button>

                {/* Switch Team Button */}
                <button
                  onClick={() => {
                    const nextTeam = player.team === 'team1' ? 'team2' : 'team1';
                    onAdminUpdatePlayer(player.username, { team: nextTeam });
                  }}
                  className="p-1.5 bg-slate-800 hover:bg-blue-900 text-slate-400 hover:text-blue-200 rounded-lg transition"
                  title={`Move Player to ${player.team === 'team1' ? 'Team 2' : 'Team 1'}`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>

                {/* Kick Player */}
                {onAdminKickUser && (
                  <button
                    onClick={() => onAdminKickUser(player.username)}
                    className="p-1.5 bg-slate-800 hover:bg-red-900 text-slate-400 hover:text-red-200 rounded-lg transition"
                    title="Kick Player from Lobby"
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Ban Player */}
                {onAdminBanUser && (
                  <button
                    onClick={() => onAdminBanUser(player.username)}
                    className="p-1.5 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-lg transition"
                    title="Ban Player from Lobby"
                  >
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* TEAM 1 LOBBY (BLUE) */}
      <div className="bg-slate-900/90 border border-blue-900/50 rounded-2xl p-4 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-900/40">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500"></span>
            <h3 className="font-bold text-sm text-blue-300 uppercase tracking-wider">
              Team 1 (Blue)
            </h3>
            <span className="bg-blue-950 text-blue-400 text-xs px-2 py-0.5 rounded-full border border-blue-800/60 font-mono font-bold">
              {team1Players.length}
            </span>
          </div>

          {/* Clickable Team Time Banner */}
          {editingTeam === 'team1' ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={60}
                value={teamTimeMinutesInput}
                onChange={(e) => setTeamTimeMinutesInput(Number(e.target.value))}
                className="w-12 bg-slate-950 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white font-mono font-bold"
              />
              <span className="text-xs text-blue-300 font-mono">mins</span>
              <button
                onClick={() => handleSaveTeamTime('team1')}
                className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 text-xs font-bold"
                title="Save Team Time"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditingTeam(null)}
                className="p-1 bg-slate-800 text-slate-400 rounded hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleStartTeamTimeEdit('team1')}
              className="group flex items-center gap-1.5 px-2.5 py-1 bg-blue-950/60 hover:bg-blue-900/80 border border-blue-800/60 rounded-xl text-xs font-mono font-bold text-blue-300 transition shadow-sm"
              title="Click to edit Team 1 Total Time"
            >
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Time: {Math.floor((roomState.team1TotalTime || 300) / 60)}m {(roomState.team1TotalTime || 300) % 60}s</span>
              <Edit2 className="w-3 h-3 text-blue-400 opacity-60 group-hover:opacity-100 transition" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {team1Players.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center italic">No players in Team 1</p>
          ) : (
            team1Players.map(renderPlayerCard)
          )}
        </div>
      </div>

      {/* TEAM 2 LOBBY (RED) */}
      <div className="bg-slate-900/90 border border-red-900/50 rounded-2xl p-4 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-red-900/40">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500"></span>
            <h3 className="font-bold text-sm text-red-300 uppercase tracking-wider">
              Team 2 (Red)
            </h3>
            <span className="bg-red-950 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-800/60 font-mono font-bold">
              {team2Players.length}
            </span>
          </div>

          {/* Clickable Team Time Banner */}
          {editingTeam === 'team2' ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={60}
                value={teamTimeMinutesInput}
                onChange={(e) => setTeamTimeMinutesInput(Number(e.target.value))}
                className="w-12 bg-slate-950 border border-red-500 rounded px-1.5 py-0.5 text-xs text-white font-mono font-bold"
              />
              <span className="text-xs text-red-300 font-mono">mins</span>
              <button
                onClick={() => handleSaveTeamTime('team2')}
                className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 text-xs font-bold"
                title="Save Team Time"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditingTeam(null)}
                className="p-1 bg-slate-800 text-slate-400 rounded hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleStartTeamTimeEdit('team2')}
              className="group flex items-center gap-1.5 px-2.5 py-1 bg-red-950/60 hover:bg-red-900/80 border border-red-800/60 rounded-xl text-xs font-mono font-bold text-red-300 transition shadow-sm"
              title="Click to edit Team 2 Total Time"
            >
              <Clock className="w-3.5 h-3.5 text-red-400" />
              <span>Time: {Math.floor((roomState.team2TotalTime || 300) / 60)}m {(roomState.team2TotalTime || 300) % 60}s</span>
              <Edit2 className="w-3 h-3 text-red-400 opacity-60 group-hover:opacity-100 transition" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {team2Players.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center italic">No players in Team 2</p>
          ) : (
            team2Players.map(renderPlayerCard)
          )}
        </div>
      </div>
    </div>
  );
};
