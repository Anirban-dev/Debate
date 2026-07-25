import React, { useState } from 'react';
import { ChatChannel, ChatMessage, MatchRoomState, Player } from '../types';
import { MessageSquare, Send, Globe, Shield, Lock, Eye, Users, AlertCircle } from 'lucide-react';

interface ChatPanelProps {
  roomState: MatchRoomState;
  currentUser: Player | null;
  onSendChat: (channel: ChatChannel, text: string) => void;
  onShowNotice?: (title: string, message: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  roomState,
  currentUser,
  onSendChat,
  onShowNotice
}) => {
  const [activeChannel, setActiveChannel] = useState<ChatChannel>('global');
  const [inputText, setInputText] = useState('');

  // Determine accessible channels based on user role and team
  const availableChannels: ChatChannel[] = React.useMemo(() => {
    if (!currentUser) return ['global'];
    if (currentUser.role === 'admin' || currentUser.role === 'spectator') return ['global'];
    if (currentUser.role === 'player' && currentUser.team) return ['global', currentUser.team];
    return ['global'];
  }, [currentUser]);

  // Ensure active channel is always allowed
  const effectiveChannel = availableChannels.includes(activeChannel) ? activeChannel : 'global';

  const { chatMessages } = roomState;

  // Filter messages strictly by active channel and allowed channels
  const filteredMessages = chatMessages.filter(m => m.channel === effectiveChannel && availableChannels.includes(m.channel));

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (!availableChannels.includes(effectiveChannel)) {
      if (onShowNotice) {
        onShowNotice('Access Denied', 'You do not have access to this chat channel.');
      }
      return;
    }

    onSendChat(effectiveChannel, trimmed);
    setInputText('');
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-[600px] lg:h-full">
      {/* Header & Accessible Channel Tabs */}
      <div className="pb-3 border-b border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">
              Live Match Chat
            </h3>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
            {availableChannels.length} {availableChannels.length === 1 ? 'Channel' : 'Channels'} Accessible
          </span>
        </div>

        {/* Dynamic Channel Selector Bar - Only Accessible Channels Rendered */}
        {availableChannels.length > 1 ? (
          <div className={`grid gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 ${
            availableChannels.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
          }`}>
            {availableChannels.includes('global') && (
              <button
                onClick={() => setActiveChannel('global')}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition ${
                  effectiveChannel === 'global'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>Global Chat</span>
              </button>
            )}

            {availableChannels.includes('team1') && (
              <button
                onClick={() => setActiveChannel('team1')}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition ${
                  effectiveChannel === 'team1'
                    ? 'bg-blue-600 text-white shadow shadow-blue-900/50'
                    : 'text-blue-400 hover:text-blue-300'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-200" />
                <span>Team 1 Private</span>
              </button>
            )}

            {availableChannels.includes('team2') && (
              <button
                onClick={() => setActiveChannel('team2')}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition ${
                  effectiveChannel === 'team2'
                    ? 'bg-red-600 text-white shadow shadow-red-900/50'
                    : 'text-red-400 hover:text-red-300'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-red-200" />
                <span>Team 2 Private</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Globe className="w-3.5 h-3.5 text-blue-400" /> Global Public Channel
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {currentUser?.role === 'admin' ? 'Host View' : currentUser?.role === 'spectator' ? 'Spectator View' : 'Public'}
            </span>
          </div>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            No messages in #{effectiveChannel} channel yet.
          </div>
        ) : (
          filteredMessages.map((msg, index) => {
            const uniqueKey = msg.id ? `${msg.id}-${index}` : `msg-${index}`;
            if (msg.isSystem) {
              return (
                <div key={uniqueKey} className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 text-xs text-slate-300 font-mono text-center">
                  {msg.text}
                </div>
              );
            }

            const isSelf = currentUser?.username === msg.senderName;

            return (
              <div
                key={uniqueKey}
                className={`flex flex-col space-y-1 ${isSelf ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 px-1 font-mono">
                  <span className="font-bold text-slate-200">@{msg.senderName}</span>
                  {msg.senderTeam && (
                    <span className={`px-1 py-0.2 rounded text-[9px] uppercase font-bold ${
                      msg.senderTeam === 'team1' ? 'bg-blue-950 text-blue-300' : 'bg-red-950 text-red-300'
                    }`}>
                      {msg.senderTeam === 'team1' ? 'Team 1' : 'Team 2'}
                    </span>
                  )}
                  {msg.senderRole === 'spectator' && (
                    <span className="bg-amber-950 text-amber-300 px-1 rounded text-[9px]">Spectator</span>
                  )}
                  <span>• {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs font-sans leading-relaxed break-words ${
                    isSelf
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : msg.senderTeam === 'team1'
                      ? 'bg-blue-950/80 border border-blue-800/60 text-blue-100 rounded-tl-none'
                      : msg.senderTeam === 'team2'
                      ? 'bg-red-950/80 border border-red-800/60 text-red-100 rounded-tl-none'
                      : 'bg-slate-800 text-slate-100 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Field */}
      <form onSubmit={handleSend} className="pt-2 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Message #${effectiveChannel}...`}
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white p-2 rounded-xl transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
