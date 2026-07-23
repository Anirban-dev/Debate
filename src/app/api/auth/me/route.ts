import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, verifyRefreshToken, setAuthCookies } from '@/lib/auth';
import { initMongoDB, findUserByOAuthId } from '@/db/mongo';

export async function GET(req: NextRequest) {
  try {
    let payload = null;
    const accessToken = req.cookies.get('access_token')?.value;

    if (accessToken) {
      payload = verifyAccessToken(accessToken);
    }

    if (!payload) {
      const refreshToken = req.cookies.get('refresh_token')?.value;
      if (refreshToken) {
        payload = verifyRefreshToken(refreshToken);
      }
    }

    if (!payload || !payload.oauthId) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    await initMongoDB();
    const dbUser = await findUserByOAuthId(payload.oauthId);

    const activeUsername = dbUser?.username || payload.username;
    const isComplete = dbUser ? (dbUser.isProfileComplete && !!activeUsername) : (payload.isProfileComplete && !!activeUsername);

    if (isComplete && activeUsername) {
      const userObj = {
        username: activeUsername,
        authProvider: payload.authProvider,
        avatarUrl: payload.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${activeUsername}`
      };

      const response = NextResponse.json({
        authenticated: true,
        needsUsername: false,
        user: userObj
      });

      setAuthCookies(response, {
        oauthId: payload.oauthId,
        username: activeUsername,
        email: payload.email,
        authProvider: payload.authProvider,
        avatarUrl: userObj.avatarUrl,
        isProfileComplete: true
      });

      return response;
    }

    // User is OAuth authenticated but needs to set a unique username
    return NextResponse.json({
      authenticated: true,
      needsUsername: true,
      oauthUser: {
        oauthId: payload.oauthId,
        email: payload.email,
        authProvider: payload.authProvider
      }
    });
  } catch (err: any) {
    console.error('Session check error:', err);
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
}
