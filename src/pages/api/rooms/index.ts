import type { NextApiRequest, NextApiResponse } from 'next';
import { activeRooms } from '@/lib/socketStore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const roomList = Object.values(activeRooms).map(r => ({
    roomId: r.roomId,
    roomTitle: r.roomTitle,
    adminUsername: r.adminUsername,
    spectatorCount: r.spectatorCount,
    playerCount: Object.values(r.players).filter(p => p.role === 'player').length,
    registeredCount: r.registeredRoster.length
  }));

  return res.status(200).json({ rooms: roomList });
}
