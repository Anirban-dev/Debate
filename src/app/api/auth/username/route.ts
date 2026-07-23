import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, verifyRefreshToken, setAuthCookies } from '@/lib/auth';
import { initMongoDB, setUniqueUsername, findUserByOAuthId } from '@/db/mongo';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Extract session token
    let tokenPayload = null;
    const accessToken = req.cookies.get('access_token')?.value;
    if (accessToken) {
      tokenPayload = verifyAccessToken(accessToken);
    }

    if (!tokenPayload) {
      const refreshToken = req.cookies.get('refresh_token')?.value;
      if (refreshToken) {
        tokenPayload = verifyRefreshToken(refreshToken);
      }
    }

    if (!tokenPayload || !tokenPayload.oauthId) {
      return NextResponse.json({ error: 'Authentication session expired. Please sign in with Google or Discord again.' }, { status: 401 });
    }

    await initMongoDB();

    // Register and set unique username in database / memory
    const updatedUser = await setUniqueUsername(tokenPayload.oauthId, username);

    const cleanUsername = username.trim().toLowerCase();
    const avatarUrl = updatedUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;

    const userObj = {
      oauthId: tokenPayload.oauthId,
      username: cleanUsername,
      authProvider: updatedUser.authProvider,
      avatarUrl,
      isProfileComplete: true
    };

    const response = NextResponse.json({
      success: true,
      user: {
        username: cleanUsername,
        authProvider: updatedUser.authProvider,
        avatarUrl
      }
    });

    // Re-issue updated cookies with profile completed
    setAuthCookies(response, userObj, req);

    return response;
  } catch (err: any) {
    console.error('Set username error:', err);
    return NextResponse.json({ error: err.message || 'Failed to claim username' }, { status: 400 });
  }
}
