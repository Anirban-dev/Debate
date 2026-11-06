import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = await cookies();

  // Known NextAuth v5 (Auth.js) and v4 cookies
  const knownCookies = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'authjs.csrf-token',
    '__Host-authjs.csrf-token',
    'authjs.callback-url',
    '__Secure-authjs.callback-url',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
    'access_token',
    'refresh_token'
  ];

  const response = NextResponse.json({ success: true });

  // Delete known cookies explicitly with options to ensure removal
  for (const cookieName of knownCookies) {
    cookieStore.delete(cookieName);
    response.cookies.delete(cookieName);
    response.cookies.set(cookieName, '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  }

  // Also iterate through all existing cookies and clear any authjs or next-auth session tokens/chunks
  const allCookies = cookieStore.getAll();
  for (const cookie of allCookies) {
    if (
      cookie.name.includes('authjs') ||
      cookie.name.includes('next-auth') ||
      cookie.name.includes('session')
    ) {
      cookieStore.delete(cookie.name);
      response.cookies.delete(cookie.name);
      response.cookies.set(cookie.name, '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      });
    }
  }

  return response;
}
