import React, { useState } from 'react';
import { MatchRoomState, Player } from '../types';
import { FileText, Plus, Download, Edit3, Check, Clock, User, Layers, Sparkles } from 'lucide-react';

interface SharedNotesPadProps {
  roomState: MatchRoomState;
  currentUser: Player | null;
  onUpdateNotePage: (pageIndex: number, title?: string, content?: string) => void;
  onAddNotePage: () => void;
  onSetActivePage: (pageIndex: number) => void;
}

export const SharedNotesPad: React.FC<SharedNotesPadProps> = ({
  roomState,
  currentUser,
  onUpdateNotePage,
  onAddNotePage,
  onSetActivePage
}) => {
  const { notesPages, activePageIndex } = roomState;
  const currentPage = notesPages[activePageIndex] || notesPages[0];

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(currentPage?.title || '');

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    if (titleInput.trim() !== currentPage.title) {
      onUpdateNotePage(activePageIndex, titleInput.trim(), undefined);
    }
  };

  const handleExportNotes = () => {
    const text = `=== MATCH NOTES: ${currentPage.title} ===\n\n${currentPage.content}\n\nLast edited by @${currentPage.lastEditedBy || 'anonymous'}`;
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${currentPage.title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 flex flex-col h-[480px]">
      {/* Header & Page Tab Strip */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <h3 className="font-bold text-sm text-white">
            Multi-Page Shared Notes
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportNotes}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition"
            title="Download note page"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button
            onClick={onAddNotePage}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/80 hover:bg-blue-900 px-2.5 py-1 rounded-lg border border-blue-800 transition font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> New Page
          </button>
        </div>
      </div>

      {/* Pages Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {notesPages.map((page, idx) => (
          <button
            key={idx}
            onClick={() => {
              onSetActivePage(idx);
              setTitleInput(page.title);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
              activePageIndex === idx
                ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-950/50'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Page {page.pageNumber}</span>
          </button>
        ))}
      </div>

      {/* Active Page Header & Editable Title */}
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
              <span>{currentPage?.title || 'Untitled Page'}</span>
              <button
                onClick={() => {
                  setTitleInput(currentPage.title);
                  setIsEditingTitle(true);
                }}
                className="text-slate-500 hover:text-slate-300 p-0.5"
                title="Rename Title"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </h4>

            {currentPage?.lastEditedBy && (
              <span className="text-[10px] text-slate-500 font-mono">
                Edited by @{currentPage.lastEditedBy}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Notepad Main Textarea */}
      <div className="flex-1 relative">
        <textarea
          value={currentPage?.content || ''}
          onChange={(e) => onUpdateNotePage(activePageIndex, undefined, e.target.value)}
          placeholder="Type live collaborative match strategy, arguments, rebuttals, or shared notes..."
          className="w-full h-full bg-slate-950 border border-slate-800 focus:border-blue-500/80 rounded-xl p-3 text-xs text-slate-200 focus:outline-none resize-none font-mono leading-relaxed"
        />
      </div>

      {/* Footer Info */}
      <div className="text-[10px] text-slate-500 flex items-center justify-between px-1">
        <span>⚡ Synced real-time across all lobby players & spectators</span>
        <span>Page {activePageIndex + 1} of {notesPages.length}</span>
      </div>
    </div>
  );
};
