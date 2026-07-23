import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

const DEFAULT_JWT_SECRET = process.env.JWT_SECRET || 'matchlobby-default-access-jwt-secret-key-32bytes!';
const DEFAULT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'matchlobby-default-refresh-jwt-secret-key-32bytes!';

export interface TokenPayload {
  username: string;
  authProvider: string;
  avatarUrl?: string;
  tokenType?: 'access' | 'refresh';
}

/**
 * Generates a short-lived Access Token (15 minutes expiration).
 */
export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(
    { ...payload, tokenType: 'access' },
    DEFAULT_JWT_SECRET,
    { expiresIn: '15m' }
  );
}

/**
 * Generates a long-lived Refresh Token (7 days expiration).
 */
export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(
    { ...payload, tokenType: 'refresh' },
    DEFAULT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verifies an Access Token.
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, DEFAULT_JWT_SECRET) as TokenPayload;
    if (decoded.tokenType && decoded.tokenType !== 'access') return null;
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Verifies a Refresh Token.
 */
export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, DEFAULT_REFRESH_SECRET) as TokenPayload;
    if (decoded.tokenType && decoded.tokenType !== 'refresh') return null;
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Attaches HTTP-only, secure access_token and refresh_token cookies to a NextResponse.
 */
export function setAuthCookies(
  response: NextResponse,
  user: { username: string; authProvider: string; avatarUrl?: string }
) {
  const payload: TokenPayload = {
    username: user.username,
    authProvider: user.authProvider,
    avatarUrl: user.avatarUrl
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const isProd = process.env.NODE_ENV === 'production';

  // Access Token Cookie (15 mins)
  response.cookies.set('access_token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15 // 15 minutes
  });

  // Refresh Token Cookie (7 days)
  response.cookies.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });

  return { accessToken, refreshToken };
}

/**
 * Clears access_token and refresh_token cookies from a NextResponse.
 */
export function clearAuthCookies(response: NextResponse) {
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  return response;
}
