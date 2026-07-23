import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChatChannel, MatchRoomState, Player, TeamId } from './types';
import { LoginPage } from './components/LoginPage';
import { LobbyHeader } from './components/LobbyHeader';
import { PlayerRosterGrid } from './components/PlayerRosterGrid';
import { ActiveSpeakerStage } from './components/ActiveSpeakerStage';
import { SharedNotesPad } from './components/SharedNotesPad';
import { ChatPanel } from './components/ChatPanel';
import { AdminPanelModal } from './components/AdminPanelModal';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomState, setRoomState] = useState<MatchRoomState | null>(null);
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io({
      autoConnect: true,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to socket server:', newSocket.id);
    });

    newSocket.on('joined_room_ack', (data: { roomState: MatchRoomState; assignedPlayer: Player }) => {
      setRoomState(data.roomState);
      setCurrentUser(data.assignedPlayer);
      setJoinedRoom(true);
    });

    newSocket.on('room_state_update', (updatedState: MatchRoomState) => {
      setRoomState(updatedState);
      // Keep currentUser updated if stats changed
      if (currentUser && updatedState.players[currentUser.username]) {
        setCurrentUser(updatedState.players[currentUser.username]);
      }
    });

    newSocket.on('chat_error', (data: { message: string }) => {
      alert(data.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleJoinRoom = (username: string, provider: 'google' | 'discord' | 'direct', isAdminRequest: boolean) => {
    if (!socket) return;
    socket.emit('join_room', {
      username,
      provider,
      isAdminRequest
    });
  };

  const handleToggleMedia = (mediaType: 'mic' | 'video', value: boolean) => {
    if (!socket || !currentUser) return;
    socket.emit('toggle_media', {
      username: currentUser.username,
      mediaType,
      value
    });
  };

  const handleSendChat = (channel: ChatChannel, text: string) => {
    if (!socket || !currentUser) return;
    socket.emit('send_chat', {
      senderUsername: currentUser.username,
      channel,
      text
    });
  };

  const handleUpdateNotePage = (pageIndex: number, title?: string, content?: string) => {
    if (!socket || !currentUser) return;
    socket.emit('update_note_page', {
      pageIndex,
      title,
      content,
      username: currentUser.username
    });
  };

  const handleAddNotePage = () => {
    if (!socket || !currentUser) return;
    socket.emit('add_note_page', { username: currentUser.username });
  };

  const handleSetActiveNotePage = (pageIndex: number) => {
    if (!socket) return;
    socket.emit('set_active_note_page', pageIndex);
  };

  const handleControlTimer = (action: "start" | "pause" | "reset" | "switch_turn", extra?: any) => {
    if (!socket) return;
    socket.emit('admin_control_timer', { action, ...extra });
  };

  const handleAdminUpdatePlayer = (targetUsername: string, updates: Partial<Player>) => {
    if (!socket) return;
    socket.emit('admin_update_player', { targetUsername, ...updates });
  };

  const handleAdminUpdateRoster = (roster: { username: string; team: TeamId; personalizedTime?: number }[]) => {
    if (!socket) return;
    socket.emit('admin_update_roster', { roster });
  };

  const handleLeaveRoom = () => {
    setJoinedRoom(false);
    setCurrentUser(null);
  };

  // Render Page 1: Login & Pre-match setup if not joined
  if (!joinedRoom) {
    return (
      <LoginPage
        roomState={roomState}
        onJoinRoom={handleJoinRoom}
        onAdminUpdateRoster={handleAdminUpdateRoster}
      />
    );
  }

  // Render Page 2: Live Match & Lobby Workspace
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Header */}
      {roomState && (
        <LobbyHeader
          roomState={roomState}
          currentUser={currentUser}
          onControlTimer={handleControlTimer}
          onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {/* Main Workspace Body */}
      {roomState && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Dual Team Lobbies & Video/Voice Roster (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            <PlayerRosterGrid
              roomState={roomState}
              currentUser={currentUser}
              onToggleMedia={handleToggleMedia}
              onAdminUpdatePlayer={handleAdminUpdatePlayer}
            />
          </div>

          {/* CENTER COLUMN: Active Speaker Stage & Shared Multi-Page Notes (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <ActiveSpeakerStage
              roomState={roomState}
              currentUser={currentUser}
            />

            <SharedNotesPad
              roomState={roomState}
              currentUser={currentUser}
              onUpdateNotePage={handleUpdateNotePage}
              onAddNotePage={handleAddNotePage}
              onSetActivePage={handleSetActiveNotePage}
            />
          </div>

          {/* RIGHT COLUMN: 3-Session Live Chat Panel (3 Cols) */}
          <div className="lg:col-span-3">
            <ChatPanel
              roomState={roomState}
              currentUser={currentUser}
              onSendChat={handleSendChat}
            />
          </div>
        </main>
      )}

      {/* Admin Suite Modal */}
      {isAdminPanelOpen && roomState && (
        <AdminPanelModal
          roomState={roomState}
          onClose={() => setIsAdminPanelOpen(false)}
          onControlTimer={handleControlTimer}
          onAdminUpdatePlayer={handleAdminUpdatePlayer}
          onAdminUpdateRoster={handleAdminUpdateRoster}
        />
      )}
    </div>
  );
}
