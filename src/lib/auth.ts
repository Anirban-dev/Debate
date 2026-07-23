import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_JWT_SECRET = process.env.JWT_SECRET || 'matchlobby-default-access-jwt-secret-key-32bytes!';
const DEFAULT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'matchlobby-default-refresh-jwt-secret-key-32bytes!';

export interface TokenPayload {
  oauthId: string;
  username?: string;
  email?: string;
  authProvider: string;
  avatarUrl?: string;
  isProfileComplete?: boolean;
  tokenType?: 'access' | 'refresh';
}

/**
 * Dynamically resolves the active application URL for OAuth redirects and app routes.
 * Prioritizes OAUTH_BASE_URL and APP_URL, falling back to request headers or localhost.
 */
export function getAppUrl(req?: NextRequest): string {
  if (process.env.APP_URL && process.env.APP_URL.trim() !== '') {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (req) {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    if (host) {
      return `${proto}://${host}`.replace(/\/$/, '');
    }
  }
  return 'http://localhost:3000';
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
  user: {
    oauthId: string;
    username?: string;
    email?: string;
    authProvider: string;
    avatarUrl?: string;
    isProfileComplete?: boolean;
  },
  req?: NextRequest
) {
  const payload: TokenPayload = {
    oauthId: user.oauthId,
    username: user.username,
    email: user.email,
    authProvider: user.authProvider,
    avatarUrl: user.avatarUrl,
    isProfileComplete: user.isProfileComplete ?? (!!user.username)
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  let isHttps = process.env.NODE_ENV === 'production';
  if (req) {
    const proto = req.headers.get('x-forwarded-proto');
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    if (proto === 'https' || (!host.includes('localhost') && !host.includes('127.0.0.1'))) {
      isHttps = true;
    }
  }

  const cookieOptions = {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };

  // Access Token Cookie (15 mins)
  response.cookies.set('access_token', accessToken, {
    ...cookieOptions,
    maxAge: 60 * 15
  });

  // Refresh Token Cookie (7 days)
  response.cookies.set('refresh_token', refreshToken, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 7
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
