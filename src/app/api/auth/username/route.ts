import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { initMongoDB, saveCompleteUser } from '@/db/mongo';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in with Google or Discord first.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const oauthId = session.user.id || session.user.email || 'user_unknown';
    const email = session.user.email || undefined;

    await initMongoDB();

    const savedUser = await saveCompleteUser(oauthId, username, email);
    const cleanUsername = savedUser.username;

    return NextResponse.json({
      success: true,
      user: {
        oauthId: savedUser.oauthId,
        username: cleanUsername,
      },
    });
  } catch (err: any) {
    console.error('Set username error:', err);
    return NextResponse.json({ error: err.message || 'Failed to claim username' }, { status: 400 });
  }
}

