import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { initMongoDB, findUserByOAuthIdOrEmail } from '@/db/mongo';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    await initMongoDB();

    const oauthId = session.user.id || session.user.email || 'user_unknown';
    const email = session.user.email || undefined;

    const dbUser = await findUserByOAuthIdOrEmail(oauthId, email);

    if (dbUser && dbUser.username) {
      return NextResponse.json({
        authenticated: true,
        needsUsername: false,
        user: {
          oauthId: dbUser.oauthId,
          username: dbUser.username,
        },
      });
    }

    return NextResponse.json({
      authenticated: true,
      needsUsername: true,
      pendingUser: {
        oauthId,
        email,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/auth/me:', err);
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
}

