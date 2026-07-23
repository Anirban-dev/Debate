import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, verifyRefreshToken, setAuthCookies, clearAuthCookies } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    let accessToken = req.cookies.get('access_token')?.value;

    if (!accessToken) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
      }
    }

    // Attempt Access Token validation
    if (accessToken) {
      const userPayload = verifyAccessToken(accessToken);
      if (userPayload) {
        return NextResponse.json({
          authenticated: true,
          user: {
            username: userPayload.username,
            authProvider: userPayload.authProvider,
            avatarUrl: userPayload.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${userPayload.username}`
          }
        });
      }
    }

    // Access Token invalid or missing — fall back to Refresh Token validation
    const refreshToken = req.cookies.get('refresh_token')?.value;
    if (refreshToken) {
      const refreshPayload = verifyRefreshToken(refreshToken);
      if (refreshPayload) {
        const user = {
          username: refreshPayload.username,
          authProvider: refreshPayload.authProvider,
          avatarUrl: refreshPayload.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${refreshPayload.username}`
        };

        const response = NextResponse.json({
          authenticated: true,
          refreshed: true,
          user
        });

        // Re-issue fresh access + refresh tokens in cookies
        setAuthCookies(response, user);
        return response;
      }
    }

    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  } catch (err: any) {
    console.error('Session check error:', err);
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
}
