import { NextRequest, NextResponse } from 'next/server';
import { initMongoDB, isMongoConnected, upsertUser } from '@/db/mongo';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, authProvider = 'direct' } = body;
    const cleanUsername = (username || '').trim().toLowerCase();

    if (!cleanUsername) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    await initMongoDB();

    if (isMongoConnected()) {
      await upsertUser(cleanUsername, authProvider);
    }

    return NextResponse.json({
      success: true,
      user: {
        username: cleanUsername,
        authProvider,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: err.message || 'Authentication failed' }, { status: 500 });
  }
}
