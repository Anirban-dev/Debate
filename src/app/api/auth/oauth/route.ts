import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider');

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/auth/callback`;

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({
        configured: false,
        message: 'Google OAuth environment variables (GOOGLE_CLIENT_ID) are not configured yet in .env.'
      });
    }

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20email%20profile`;

    return NextResponse.json({ configured: true, authUrl: googleAuthUrl });
  }

  if (provider === 'discord') {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({
        configured: false,
        message: 'Discord OAuth environment variables (DISCORD_CLIENT_ID) are not configured yet in .env.'
      });
    }

    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=identify%20email`;

    return NextResponse.json({ configured: true, authUrl: discordAuthUrl });
  }

  return NextResponse.json({ error: 'Invalid provider parameter' }, { status: 400 });
}
