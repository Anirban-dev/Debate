import React from 'react';
import { MatchRoomState, Player, TeamId } from '../types';
import { Eye, LogOut, ShieldAlert, UserCheck, UserX, Ban, Info, Shield, Radio } from 'lucide-react';

interface SpectatorLoungeProps {
  roomState: MatchRoomState;
  currentUser: Player | null;
  onLeaveRoom: () => void;
  onAdminKickUser?: (targetUsername: string) => void;
  onAdminBanUser?: (targetUsername: string) => void;
  onAdminPromoteSpectator?: (targetUsername: string, team: TeamId) => void;
}

export const SpectatorLounge: React.FC<SpectatorLoungeProps> = ({
  roomState,
  currentUser,
  onLeaveRoom,
  onAdminKickUser,
  onAdminBanUser,
  onAdminPromoteSpectator
}) => {
  const { players, isPersonalLobby, spectatorCount } = roomState;

  const spectatorsList = (Object.values(players) as Player[]).filter(
    p => p.role === 'spectator' && p.isOnline
  );

  const isSelfSpectator = currentUser?.role === 'spectator';
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="bg-slate-900/90 border border-amber-900/40 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-white tracking-tight">
                Spectator Lounge & Gallery
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/80 text-xs font-mono font-bold">
                {spectatorsList.length} Active
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Spectators enjoy live stream viewing without mic or camera requirements.
            </p>
          </div>
        </div>

        {/* Leave Lobby Button for Spectator or Player */}
        {isSelfSpectator && (
          <button
            onClick={onLeaveRoom}
            className="bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
          >
            <LogOut className="w-4 h-4" /> Leave Match Arena
          </button>
        )}
      </div>

      {/* Info Notice Banner */}
      <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex items-start gap-3 text-xs text-slate-300">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-200">Spectator Permission Model:</p>
          <p className="text-slate-400 leading-relaxed">
            Spectators can watch live speakers, view global chat, and interact without audio/video device access. Admin can promote spectators to team players or kick/ban non-compliant viewers.
          </p>
          {isPersonalLobby && (
            <p className="text-amber-400/90 text-[11px] font-mono font-medium pt-1">
              * Note: In Personal Lobbies, global admin controls are non-intrusive and managed within the lobby.
            </p>
          )}
        </div>
      </div>

      {/* Spectator List Grid */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
          <span>Connected Spectator Roster</span>
          {isAdmin && <span className="text-purple-400 text-[11px]">Admin Control Enabled</span>}
        </h4>

        {spectatorsList.length === 0 ? (
          <div className="text-center py-8 bg-slate-950/50 rounded-xl border border-slate-800/60 text-slate-500 text-xs italic">
            No active spectators currently viewing in the lounge.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {spectatorsList.map((spectator) => {
              const isSelf = currentUser?.username === spectator.username;

              return (
                <div
                  key={spectator.username}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                    isSelf
                      ? 'bg-amber-950/30 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                      : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={spectator.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${spectator.username}`}
                        alt={spectator.username}
                        className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 object-cover"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900"></span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white truncate font-mono">
                          @{spectator.username}
                        </span>
                        {isSelf && (
                          <span className="text-[9px] bg-amber-900/60 text-amber-200 border border-amber-800 px-1 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        Viewer &bull; No Cam/Mic needed
                      </span>
                    </div>
                  </div>

                  {/* Admin Actions for Spectators */}
                  {isAdmin && onAdminKickUser && onAdminBanUser && (
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Promote to Team 1 */}
                      {onAdminPromoteSpectator && (
                        <button
                          onClick={() => onAdminPromoteSpectator(spectator.username, 'team1')}
                          className="px-1.5 py-1 bg-blue-900/60 hover:bg-blue-800 text-blue-200 text-[10px] font-bold rounded border border-blue-700"
                          title="Promote to Team 1 Player"
                        >
                          +Team 1
                        </button>
                      )}

                      {/* Promote to Team 2 */}
                      {onAdminPromoteSpectator && (
                        <button
                          onClick={() => onAdminPromoteSpectator(spectator.username, 'team2')}
                          className="px-1.5 py-1 bg-red-900/60 hover:bg-red-800 text-red-200 text-[10px] font-bold rounded border border-red-700"
                          title="Promote to Team 2 Player"
                        >
                          +Team 2
                        </button>
                      )}

                      {/* Kick Spectator */}
                      <button
                        onClick={() => onAdminKickUser(spectator.username)}
                        className="p-1.5 bg-slate-800 hover:bg-red-900 text-slate-300 hover:text-red-200 rounded transition"
                        title="Kick Spectator from Lobby"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>

                      {/* Ban Spectator */}
                      <button
                        onClick={() => onAdminBanUser(spectator.username)}
                        className="p-1.5 bg-red-950 hover:bg-red-900 text-red-400 hover:text-red-100 rounded border border-red-800 transition"
                        title="Ban Spectator from Lobby"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
