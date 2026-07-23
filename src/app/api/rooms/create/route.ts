import { NextRequest, NextResponse } from 'next/server';
import { activeRooms } from '@/lib/socketStore';
import { MatchRoomState } from '@/types';
import { initMongoDB, isMongoConnected, upsertRoom } from '@/db/mongo';

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

    const newRoomState: MatchRoomState = {
      roomId: cleanRoomId,
      roomTitle: roomTitle || `Match Room (${cleanRoomId})`,
      adminUsername: cleanAdmin,
      players: {},
      registeredRoster: registeredRoster.map((r: any) => ({
        username: r.username.trim().toLowerCase(),
        team: r.team,
        personalizedTime: Number(r.personalizedTime) || 180
      })),
      notesPages: [
        {
          pageNumber: 1,
          title: "Page 1: Match Rules & Notes",
          content: `# ${roomTitle || 'Match Notes'}\n\n- Created by @${cleanAdmin}\n- Team 1 Total: ${team1TotalTime}s\n- Team 2 Total: ${team2TotalTime}s`,
          updatedAt: Date.now()
        }
      ],
      activePageIndex: 0,
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

    await initMongoDB();

    if (isMongoConnected()) {
      await upsertRoom({
        roomId: cleanRoomId,
        roomTitle: newRoomState.roomTitle,
        adminUsername: cleanAdmin,
        team1TotalTime: Number(team1TotalTime),
        team2TotalTime: Number(team2TotalTime),
        warningThresholdSeconds: Number(warningThresholdSeconds),
        registeredRoster: newRoomState.registeredRoster
      });
    }

    return NextResponse.json({ success: true, room: newRoomState });
  } catch (err: any) {
    console.error('Create room error:', err);
    return NextResponse.json({ error: err.message || 'Room creation failed' }, { status: 500 });
  }
}
