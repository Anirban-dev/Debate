import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, setAuthCookies, clearAuthCookies } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // Read refresh token from HTTP-only cookie or Authorization header
    let refreshToken = req.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        refreshToken = authHeader.substring(7);
      }
    }

    if (!refreshToken) {
      const response = NextResponse.json({ error: 'Refresh token missing' }, { status: 401 });
      clearAuthCookies(response);
      return response;
    }

    const payload = verifyRefreshToken(refreshToken);

    if (!payload) {
      const response = NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
      clearAuthCookies(response);
      return response;
    }

    const user = {
      username: payload.username,
      authProvider: payload.authProvider,
      avatarUrl: payload.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${payload.username}`
    };

    const response = NextResponse.json({
      success: true,
      user,
      message: 'Tokens refreshed successfully'
    });

    // Issue fresh Access Token and Refresh Token
    setAuthCookies(response, user);

    return response;
  } catch (err: any) {
    console.error('Refresh token error:', err);
    return NextResponse.json({ error: 'Failed to refresh token' }, { status: 500 });
  }
}
