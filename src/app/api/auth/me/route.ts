import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();

    if (session?.user) {
      const rawName = session.user.name || session.user.email?.split('@')[0] || 'player';
      const cleanUsername = rawName.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'player';
      const avatarUrl = session.user.image || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;
      
      return NextResponse.json({
        authenticated: true,
        user: {
          username: cleanUsername,
          authProvider: 'nextauth',
          avatarUrl
        }
      });
    }

    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
}
