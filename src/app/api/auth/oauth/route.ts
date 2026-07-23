import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAppUrl } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider');

  const appUrl = getAppUrl(req);
  const redirectUri = `${appUrl}/api/auth/callback`;

  // Cryptographically secure random nonce for Anti-CSRF protection
  const stateNonce = crypto.randomUUID();
  const stateValue = `${provider}:${stateNonce}`;

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json({
        configured: false,
        redirectUri,
        message: 'Google OAuth environment variables (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) are required.'
      });
    }

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20email%20profile&state=${encodeURIComponent(
      stateValue
    )}&prompt=select_account`;

    const res = NextResponse.json({ configured: true, authUrl: googleAuthUrl, redirectUri });
    // Secure HTTP-Only Cookie to prevent CSRF attacks in cross-origin iframe context
    res.cookies.set('oauth_state', stateValue, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
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
        redirectUri,
        message: 'Discord OAuth environment variables (DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET) are required.'
      });
    }

    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=identify%20email&state=${encodeURIComponent(stateValue)}`;

    const res = NextResponse.json({ configured: true, authUrl: discordAuthUrl, redirectUri });
    res.cookies.set('oauth_state', stateValue, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 60 * 10
    });
    return res;
  }

  return NextResponse.json({ error: 'Invalid provider parameter' }, { status: 400 });
}
