import React, { useState } from 'react';
import { MatchRoomState, Player, TeamId } from '../types';
import { FileText, Download, Edit3, Check, Lock, ShieldAlert, Sparkles, Layers } from 'lucide-react';

interface SharedNotesPadProps {
  roomState: MatchRoomState;
  currentUser: Player | null;
  onUpdateTeamNotes: (teamId: TeamId, title?: string, content?: string) => void;
}

export const SharedNotesPad: React.FC<SharedNotesPadProps> = ({
  roomState,
  currentUser,
  onUpdateTeamNotes
}) => {
  const { teamNotes } = roomState;

  const isAdmin = currentUser?.role === 'admin';
  const isSpectator = currentUser?.role === 'spectator';
  const userTeam = currentUser?.team || 'team1';

  const currentTeamNote = teamNotes ? teamNotes[userTeam] : null;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(currentTeamNote?.title || '');

  // 1. ADMIN RESTRICTION VIEW
  if (isAdmin) {
    return (
      <div className="bg-slate-900/90 border border-purple-900/50 rounded-2xl p-6 shadow-xl space-y-4 text-center">
        <div className="inline-flex p-3 bg-purple-950/80 text-purple-400 rounded-2xl border border-purple-800/80">
          <Lock className="w-8 h-8" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-lg font-bold text-white">
            🔒 Admin Strategy Privacy Shield
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Team shared notes contain private match arguments, rebuttals, and strategy. To ensure fair play, the Admin Host cannot view or access either team&apos;s confidential scratchpad.
          </p>
        </div>
        <div className="inline-block bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-[11px] text-purple-300 font-mono">
          2 Separate Private Team Pads Active (Team 1 & Team 2)
        </div>
      </div>
    );
  }

  // 2. SPECTATOR RESTRICTION VIEW
  if (isSpectator) {
    return (
      <div className="bg-slate-900/90 border border-amber-900/40 rounded-2xl p-6 shadow-xl space-y-4 text-center">
        <div className="inline-flex p-3 bg-amber-950/80 text-amber-400 rounded-2xl border border-amber-800/80">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-lg font-bold text-white">
            🔒 Team Strategy Restricted
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Shared strategy pads are strictly confidential to active Team 1 and Team 2 players. Spectators cannot view private team notes during live rounds.
          </p>
        </div>
      </div>
    );
  }

  // 3. TEAM PLAYER VIEW (Private note for player's team)
  if (!currentTeamNote) return null;

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    if (titleInput.trim() !== currentTeamNote.title) {
      onUpdateTeamNotes(userTeam, titleInput.trim(), undefined);
    }
  };

  const handleExportNotes = () => {
    const text = `=== ${currentTeamNote.title.toUpperCase()} ===\n\n${currentTeamNote.content}\n\nLast edited by @${currentTeamNote.lastEditedBy || 'anonymous'}`;
    const element = document.createElement("a");
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${currentTeamNote.title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className={`bg-slate-900/90 border rounded-2xl p-4 shadow-xl space-y-3 flex flex-col h-[480px] ${
      userTeam === 'team1' ? 'border-blue-900/60' : 'border-red-900/60'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${userTeam === 'team1' ? 'bg-blue-500' : 'bg-red-500'}`}></span>
          <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
            <span>{userTeam === 'team1' ? 'Team 1 (Blue) Strategy Pad' : 'Team 2 (Red) Strategy Pad'}</span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">Private</span>
          </h3>
        </div>

        <button
          onClick={handleExportNotes}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition"
          title="Download team note"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {/* Title Bar */}
      <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
        {isEditingTitle ? (
          <div className="flex items-center gap-2 w-full">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="bg-slate-900 text-white text-xs px-2 py-1 rounded border border-blue-500 w-full focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleTitleSave}
              className="p-1 bg-blue-600 text-white rounded hover:bg-blue-500"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <h4 className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
              <span>{currentTeamNote.title}</span>
              <button
                onClick={() => {
                  setTitleInput(currentTeamNote.title);
                  setIsEditingTitle(true);
                }}
                className="text-slate-500 hover:text-slate-300 p-0.5"
                title="Rename Title"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </h4>

            {currentTeamNote.lastEditedBy && (
              <span className="text-[10px] text-slate-500 font-mono">
                Last edited by @{currentTeamNote.lastEditedBy}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Textarea */}
      <div className="flex-1 relative">
        <textarea
          value={currentTeamNote.content || ''}
          onChange={(e) => onUpdateTeamNotes(userTeam, undefined, e.target.value)}
          placeholder={`Type live collaborative strategy for ${userTeam === 'team1' ? 'Team 1' : 'Team 2'}...`}
          className="w-full h-full bg-slate-950 border border-slate-800 focus:border-blue-500/80 rounded-xl p-3 text-xs text-slate-200 focus:outline-none resize-none font-mono leading-relaxed"
        />
      </div>

      {/* Footer Info */}
      <div className="text-[10px] text-slate-500 flex items-center justify-between px-1">
        <span>🔒 Confidential to {userTeam === 'team1' ? 'Team 1' : 'Team 2'} &bull; Hidden from Admin & Opponents</span>
        <span>Real-Time Sync Active</span>
      </div>
    </div>
  );
};
