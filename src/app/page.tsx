'use client';

import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChatChannel, MatchRoomState, Player, TeamId } from '@/types';
import { LoginStep } from '@/components/LoginStep';
import { ModeSelectionStep } from '@/components/ModeSelectionStep';
import { LobbyHeader } from '@/components/LobbyHeader';
import { PlayerRosterGrid } from '@/components/PlayerRosterGrid';
import { ActiveSpeakerStage } from '@/components/ActiveSpeakerStage';
import { SharedNotesPad } from '@/components/SharedNotesPad';
import { ChatPanel } from '@/components/ChatPanel';
import { AdminPanelModal } from '@/components/AdminPanelModal';

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);

  // App step flow: 'login' -> 'mode_select' -> 'in_game'
  const [appStep, setAppStep] = useState<'login' | 'mode_select' | 'in_game'>('login');

  // Authenticated user from LoginStep
  const [authUser, setAuthUser] = useState<{ username: string; authProvider: string; avatarUrl: string } | null>(null);

  // Active room state and player role object
  const [roomState, setRoomState] = useState<MatchRoomState | null>(null);
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string>('main-lobby');

  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // Initialize Socket.IO connection
  useEffect(() => {
    let socketInstance: Socket | null = null;

    const initSocket = async () => {
      // First ensure Next.js API socket server is initialized
      await fetch('/api/socket/io');

      socketInstance = io({
        path: '/api/socket/io',
        autoConnect: true,
        transports: ['websocket', 'polling']
      });

      socketInstance.on('connect', () => {
        console.log('Connected to Next.js Socket server:', socketInstance?.id);
      });

      socketInstance.on('joined_room_ack', (data: { roomState: MatchRoomState; assignedPlayer: Player }) => {
        setRoomState(data.roomState);
        setCurrentUser(data.assignedPlayer);
        setAppStep('in_game');
      });

      socketInstance.on('room_state_update', (updatedState: MatchRoomState) => {
        setRoomState(updatedState);
        if (currentUser && updatedState.players[currentUser.username]) {
          setCurrentUser(updatedState.players[currentUser.username]);
        }
      });

      socketInstance.on('chat_error', (data: { message: string }) => {
        alert(data.message);
      });

      setSocket(socketInstance);
    };

    initSocket();

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, []);

  // Step 1 Complete: User Login
  const handleLoginSuccess = (user: { username: string; authProvider: string; avatarUrl: string }) => {
    setAuthUser(user);
    setAppStep('mode_select');
  };

  // Step 2 Action: Enter Game (or after Create Game)
  const handleEnterGame = async (roomIdToJoin: string) => {
    const cleanRoom = roomIdToJoin.trim().toLowerCase() || 'main-lobby';
    setCurrentRoomId(cleanRoom);

    if (!authUser) return;

    if (!socket) {
      await fetch('/api/socket/io');
      const newSock = io({
        path: '/api/socket/io',
        autoConnect: true,
        transports: ['websocket', 'polling']
      });
      setSocket(newSock);

      newSock.emit('join_room', {
        roomId: cleanRoom,
        username: authUser.username,
        provider: authUser.authProvider
      });
    } else {
      socket.emit('join_room', {
        roomId: cleanRoom,
        username: authUser.username,
        provider: authUser.authProvider
      });
    }
  };

  const handleLogout = () => {
    setAuthUser(null);
    setCurrentUser(null);
    setRoomState(null);
    setAppStep('login');
  };

  const handleLeaveRoom = () => {
    setCurrentUser(null);
    setRoomState(null);
    setAppStep('mode_select');
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

  // STEP 1: LOGIN PAGE
  if (appStep === 'login') {
    return <LoginStep onLoginSuccess={handleLoginSuccess} />;
  }

  // STEP 2: MODE SELECTION PAGE (CREATE A GAME vs ENTER A GAME)
  if (appStep === 'mode_select' && authUser) {
    return (
      <ModeSelectionStep
        currentUser={authUser}
        onEnterGame={handleEnterGame}
        onLogout={handleLogout}
      />
    );
  }

  // STEP 3: LIVE MATCH LOBBY & GAME VIEW
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
