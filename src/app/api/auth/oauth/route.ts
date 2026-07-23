import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider');

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/auth/callback`;

  // Cryptographically secure random nonce for Anti-CSRF protection
  const stateNonce = crypto.randomUUID();
  const stateValue = `${provider}:${stateNonce}`;

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json({
        configured: false,
        message: 'Google OAuth environment variables (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) are required in .env.'
      });
    }

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20email%20profile&state=${encodeURIComponent(
      stateValue
    )}&prompt=select_account`;

    const res = NextResponse.json({ configured: true, authUrl: googleAuthUrl });
    // Secure HTTP-Only Cookie to prevent CSRF attacks
    res.cookies.set('oauth_state', stateValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10 // 10 minutes expiry
    });
    return res;
  }

  if (provider === 'discord') {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json({
        configured: false,
        message: 'Discord OAuth environment variables (DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET) are required in .env.'
      });
    }

    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=identify%20email&state=${encodeURIComponent(stateValue)}`;

    const res = NextResponse.json({ configured: true, authUrl: discordAuthUrl });
    res.cookies.set('oauth_state', stateValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10
    });
    return res;
  }

  return NextResponse.json({ error: 'Invalid provider parameter' }, { status: 400 });
}
