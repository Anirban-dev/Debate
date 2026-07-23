import { NextRequest, NextResponse } from 'next/server';
import { initMongoDB, isMongoConnected, upsertUser } from '@/db/mongo';
import { setAuthCookies } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, password, authProvider = 'direct' } = body;
    const cleanUsername = (username || '').trim().toLowerCase();

    if (!cleanUsername) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    if (authProvider === 'direct') {
      if (!password || password.length < 4) {
        return NextResponse.json({ error: 'Password of at least 4 characters is required for account authentication.' }, { status: 400 });
      }
    }

    await initMongoDB();

    if (isMongoConnected()) {
      await upsertUser(cleanUsername, authProvider);
    }

    const user = {
      username: cleanUsername,
      authProvider,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`
    };

    const response = NextResponse.json({
      success: true,
      user
    });

    // Attach HTTP-only secure Access Token (15m) and Refresh Token (7d) cookies
    setAuthCookies(response, user);

    return response;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: err.message || 'Authentication failed' }, { status: 500 });
  }
}
