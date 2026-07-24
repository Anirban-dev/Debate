import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { initMongoDB, findUserByOAuthIdOrEmail, createOrUpdateOAuthUser } from '@/db/mongo';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    await initMongoDB();

    const oauthId = session.user.id || session.user.email || 'user_unknown';
    const email = session.user.email || undefined;
    const avatarUrl = session.user.image || `https://api.dicebear.com/7.x/bottts/svg?seed=${oauthId}`;

    let dbUser = await findUserByOAuthIdOrEmail(oauthId, email);
    if (!dbUser) {
      dbUser = await createOrUpdateOAuthUser({
        oauthId,
        email,
        authProvider: 'nextauth',
        avatarUrl,
      });
    }

    if (dbUser && (dbUser.username || dbUser.isProfileComplete)) {
      const username = dbUser.username || (email ? email.split('@')[0].replace(/[^a-z0-9_]/g, '') : 'player');
      return NextResponse.json({
        authenticated: true,
        needsUsername: false,
        user: {
          oauthId: dbUser.oauthId,
          username,
          authProvider: dbUser.authProvider || 'nextauth',
          avatarUrl: dbUser.avatarUrl || avatarUrl,
        },
      });
    }

    return NextResponse.json({
      authenticated: true,
      needsUsername: true,
      pendingUser: {
        oauthId,
        email,
        avatarUrl,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/auth/me:', err);
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
}
