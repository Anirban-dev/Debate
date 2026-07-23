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
import { Video, FileText, MessageSquare, LayoutGrid } from 'lucide-react';

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

  // View navigation tab in match lobby: 'stage' | 'notes' | 'chat' | 'all'
  const [activeViewTab, setActiveViewTab] = useState<'stage' | 'notes' | 'chat' | 'all'>('stage');

  // Check active session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setAuthUser(data.user);
            setAppStep('mode_select');
          }
        }
      } catch (err) {
        // Session not active, remain on login screen
      }
    };
    checkSession();
  }, []);

  // Initialize Socket.IO connection
  useEffect(() => {
    let socketInstance: Socket | null = null;

    const initSocket = async () => {
      // Ensure Next.js API socket server is initialized
      await fetch('/api/socket/io');

      socketInstance = io({
        path: '/api/socket/io',
        autoConnect: true,
        transports: ['websocket', 'polling']
      });

      socketInstance.on('connect', () => {
        console.log('Connected to Socket server:', socketInstance?.id);
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore network errors
    }
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

  // STEP 1: LOGIN PAGE
  if (appStep === 'login') {
    return <LoginStep onLoginSuccess={handleLoginSuccess} />;
  }

  // STEP 2: MODE SELECTION PAGE
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

      {/* Simplified Navigation View Switcher Bar */}
      {roomState && (
        <div className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-md sticky top-[65px] z-20">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveViewTab('stage')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeViewTab === 'stage'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Stage & Video Grid</span>
              </button>

              <button
                onClick={() => setActiveViewTab('notes')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeViewTab === 'notes'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Shared Notes</span>
              </button>

              <button
                onClick={() => setActiveViewTab('chat')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeViewTab === 'chat'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Match Chat</span>
              </button>

              <button
                onClick={() => setActiveViewTab('all')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeViewTab === 'all'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">All-in-One Dashboard</span>
              </button>
            </div>

            <div className="text-xs text-slate-400 font-medium hidden md:block">
              Click <span className="text-blue-400 font-semibold">Video</span> button in roster to turn webcam feed ON/OFF
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace View Body */}
      {roomState && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
          {/* VIEW 1: STAGE & VIDEO GRID (DEFAULT) */}
          {activeViewTab === 'stage' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-6">
                <ActiveSpeakerStage
                  roomState={roomState}
                  currentUser={currentUser}
                  onToggleMedia={handleToggleMedia}
                />
              </div>

              <div className="lg:col-span-5 space-y-6">
                <PlayerRosterGrid
                  roomState={roomState}
                  currentUser={currentUser}
                  onToggleMedia={handleToggleMedia}
                  onAdminUpdatePlayer={handleAdminUpdatePlayer}
                />
              </div>
            </div>
          )}

          {/* VIEW 2: SHARED NOTES */}
          {activeViewTab === 'notes' && (
            <div className="max-w-4xl mx-auto">
              <SharedNotesPad
                roomState={roomState}
                currentUser={currentUser}
                onUpdateNotePage={handleUpdateNotePage}
                onAddNotePage={handleAddNotePage}
                onSetActivePage={handleSetActiveNotePage}
              />
            </div>
          )}

          {/* VIEW 3: MATCH CHAT */}
          {activeViewTab === 'chat' && (
            <div className="max-w-2xl mx-auto">
              <ChatPanel
                roomState={roomState}
                currentUser={currentUser}
                onSendChat={handleSendChat}
              />
            </div>
          )}

          {/* VIEW 4: ALL-IN-ONE DASHBOARD */}
          {activeViewTab === 'all' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-6">
                <PlayerRosterGrid
                  roomState={roomState}
                  currentUser={currentUser}
                  onToggleMedia={handleToggleMedia}
                  onAdminUpdatePlayer={handleAdminUpdatePlayer}
                />
              </div>

              <div className="lg:col-span-5 space-y-6">
                <ActiveSpeakerStage
                  roomState={roomState}
                  currentUser={currentUser}
                  onToggleMedia={handleToggleMedia}
                />

                <SharedNotesPad
                  roomState={roomState}
                  currentUser={currentUser}
                  onUpdateNotePage={handleUpdateNotePage}
                  onAddNotePage={handleAddNotePage}
                  onSetActivePage={handleSetActiveNotePage}
                />
              </div>

              <div className="lg:col-span-3">
                <ChatPanel
                  roomState={roomState}
                  currentUser={currentUser}
                  onSendChat={handleSendChat}
                />
              </div>
            </div>
          )}
        </main>
      )}

      {/* Admin Suite Modal */}
      {isAdminPanelOpen && roomState && (
        <AdminPanelModal
          roomState={roomState}
          onClose={() => setIsAdminPanelOpen(false)}
          onControlTimer={handleControlTimer}
          onAdminUpdatePlayer={handleAdminUpdatePlayer}
        />
      )}
    </div>
  );
}
