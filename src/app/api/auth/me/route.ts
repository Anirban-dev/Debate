import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { initMongoDB, findUserByOAuthId, createOrUpdateOAuthUser } from '@/db/mongo';

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

    let dbUser = await findUserByOAuthId(oauthId);
    if (!dbUser) {
      dbUser = await createOrUpdateOAuthUser({
        oauthId,
        email,
        authProvider: 'nextauth',
        avatarUrl,
      });
    }

    if (dbUser && dbUser.isProfileComplete && dbUser.username) {
      return NextResponse.json({
        authenticated: true,
        needsUsername: false,
        user: {
          oauthId: dbUser.oauthId,
          username: dbUser.username,
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
