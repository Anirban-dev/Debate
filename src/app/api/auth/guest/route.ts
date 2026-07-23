import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { setAuthCookies } from '@/lib/auth';
import { initMongoDB, createOrUpdateOAuthUser, setUniqueUsername } from '@/db/mongo';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      return NextResponse.json(
        { error: 'Username must be 3-20 characters long and contain only letters, numbers, or underscores.' },
        { status: 400 }
      );
    }

    await initMongoDB();

    const guestOauthId = `guest_${cleanUsername}`;
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;

    // Create user in store
    await createOrUpdateOAuthUser({
      oauthId: guestOauthId,
      email: `${cleanUsername}@guest.local`,
      authProvider: 'guest',
      avatarUrl
    });

    const updatedUser = await setUniqueUsername(guestOauthId, cleanUsername);

    const userObj = {
      oauthId: guestOauthId,
      username: cleanUsername,
      authProvider: 'guest',
      avatarUrl,
      isProfileComplete: true
    };

    const response = NextResponse.json({
      success: true,
      user: {
        username: cleanUsername,
        authProvider: 'guest',
        avatarUrl
      }
    });

    setAuthCookies(response, userObj, req);

    return response;
  } catch (err: any) {
    console.error('Guest login error:', err);
    return NextResponse.json({ error: err.message || 'Failed to enter as guest' }, { status: 400 });
  }
}
