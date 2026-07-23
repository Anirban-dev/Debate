import { NextResponse } from 'next/server';
import { activeRooms } from '@/lib/socketStore';

export async function GET() {
  const roomList = Object.values(activeRooms).map(r => ({
    roomId: r.roomId,
    roomTitle: r.roomTitle,
    adminUsername: r.adminUsername,
    spectatorCount: r.spectatorCount,
    playerCount: Object.values(r.players).filter(p => p.role === 'player').length,
    registeredCount: r.registeredRoster.length
  }));

  return NextResponse.json({ rooms: roomList });
}
