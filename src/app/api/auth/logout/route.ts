import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  // Clear NextAuth session cookies
  const cookiesToClear = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'access_token',
    'refresh_token'
  ];

  for (const cookieName of cookiesToClear) {
    response.cookies.delete(cookieName);
  }

  return response;
}
