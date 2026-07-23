import type { NextApiRequest, NextApiResponse } from 'next';
import { initMongoDB, isMongoConnected, upsertUser } from '@/db/mongo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, authProvider = 'direct' } = req.body || {};
    const cleanUsername = (username || '').trim().toLowerCase();

    if (!cleanUsername) {
      return res.status(400).json({ error: "Username is required" });
    }

    await initMongoDB();

    if (isMongoConnected()) {
      await upsertUser(cleanUsername, authProvider);
    }

    return res.status(200).json({
      success: true,
      user: {
        username: cleanUsername,
        authProvider,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Authentication failed' });
  }
}
