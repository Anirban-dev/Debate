import { NextRequest, NextResponse } from 'next/server';
import { activeRooms } from '@/lib/socketStore';
import { MatchRoomState } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      roomId,
      roomTitle,
      adminUsername,
      registeredRoster = [],
      team1TotalTime = 300,
      team2TotalTime = 300,
      warningThresholdSeconds = 10
    } = body;

    const cleanRoomId = (roomId || '').trim().toLowerCase().replace(/\s+/g, '-');
    const cleanAdmin = (adminUsername || '').trim().toLowerCase();

    if (!cleanRoomId || !cleanAdmin) {
      return NextResponse.json({ error: "Room ID and Admin Username are required" }, { status: 400 });
    }

    if (activeRooms[cleanRoomId]) {
      const room = activeRooms[cleanRoomId];
      if (room.adminUsername && room.adminUsername.toLowerCase() !== cleanAdmin) {
        return NextResponse.json(
          { error: `Room ID "${cleanRoomId}" already exists. Please choose a different Room ID.` },
          { status: 400 }
        );
      }
      // Same admin reconfiguring room
      room.roomTitle = roomTitle || room.roomTitle;
      room.adminUsername = cleanAdmin;
      if (registeredRoster.length > 0) {
        room.registeredRoster = registeredRoster.map((r: any) => ({
          username: r.username.trim().toLowerCase(),
          team: r.team,
          personalizedTime: Number(r.personalizedTime) || 180
        }));
      }
      if (team1TotalTime) {
        room.team1TotalTime = Number(team1TotalTime);
        if (!room.timer.isRunning) room.timer.team1TimeRemaining = Number(team1TotalTime);
      }
      if (team2TotalTime) {
        room.team2TotalTime = Number(team2TotalTime);
        if (!room.timer.isRunning) room.timer.team2TimeRemaining = Number(team2TotalTime);
      }
      return NextResponse.json({ success: true, room, reconfigured: true });
    }

    const newRoomState: MatchRoomState = {
      roomId: cleanRoomId,
      roomTitle: roomTitle || `Match Room (${cleanRoomId})`,
      adminUsername: cleanAdmin,
      isPersonalLobby: cleanRoomId !== "main-lobby",
      players: {},
      bannedUsernames: [],
      registeredRoster: registeredRoster.map((r: any) => ({
        username: r.username.trim().toLowerCase(),
        team: r.team,
        personalizedTime: Number(r.personalizedTime) || 180
      })),
      teamNotes: {
        team1: {
          teamId: "team1",
          title: "Team 1 Secret Strategy Pad",
          content: `# ${roomTitle || 'Match Room'} - Team 1 Strategy\n\n- Key points for debate.`,
          updatedAt: Date.now()
        },
        team2: {
          teamId: "team2",
          title: "Team 2 Secret Strategy Pad",
          content: `# ${roomTitle || 'Match Room'} - Team 2 Strategy\n\n- Key points for debate.`,
          updatedAt: Date.now()
        }
      },
      chatMessages: [
        {
          id: `sys-created-${Date.now()}`,
          senderId: "system",
          senderName: "System",
          senderRole: "admin",
          channel: "global",
          text: `🚀 Room created by Host @${cleanAdmin}. Players in pre-match roster will auto-redirect as Team Players!`,
          timestamp: Date.now(),
          isSystem: true
        }
      ],
      timer: {
        activeTeam: "team1",
        activePlayerId: null,
        isRunning: false,
        team1TimeRemaining: Number(team1TotalTime),
        team2TimeRemaining: Number(team2TotalTime),
        turnTimeRemaining: 60,
        warningThresholdSeconds: Number(warningThresholdSeconds),
        isWarningActive: false,
        autoMutedTriggered: false
      },
      spectatorCount: 0,
      team1TotalTime: Number(team1TotalTime),
      team2TotalTime: Number(team2TotalTime)
    };

    activeRooms[cleanRoomId] = newRoomState;

    return NextResponse.json({ success: true, room: newRoomState });
  } catch (err: any) {
    console.error('Create room error:', err);
    return NextResponse.json({ error: err.message || 'Room creation failed' }, { status: 500 });
  }
}

