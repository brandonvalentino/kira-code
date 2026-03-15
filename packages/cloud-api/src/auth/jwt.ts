/**
 * JWT verification for cloud-api.
 * Uses HS256 with a shared secret (KIRACODE_REMOTE_JWT_SECRET), matching
 * the existing Rust remote server implementation.
 */
import jwt from 'jsonwebtoken';

export interface AccessTokenClaims {
  sub: string; // user UUID
  session_id: string;
  iat: number;
  exp: number;
  aud: string;
}

export interface RefreshTokenClaims {
  sub: string;
  session_id: string;
  jti: string; // refresh token ID
  iat: number;
  exp: number;
  aud: string;
}

export type TokenType = 'access' | 'refresh';

const ACCESS_TOKEN_TTL_SECONDS = 120;
const REFRESH_TOKEN_TTL_DAYS = 365;
const JWT_AUDIENCE = 'kira-remote';

export class JwtService {
  private readonly secret: string;

  constructor(secret: string) {
    if (!secret || secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters');
    }
    this.secret = secret;
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    try {
      const claims = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        audience: JWT_AUDIENCE,
        clockTolerance: 60,
      }) as AccessTokenClaims;

      return claims;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new JwtError('token_expired', 'Access token has expired');
      }
      throw new JwtError('invalid_token', 'Invalid access token');
    }
  }

  verifyRefreshToken(token: string): RefreshTokenClaims {
    try {
      const claims = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        audience: JWT_AUDIENCE,
        clockTolerance: 60,
      }) as RefreshTokenClaims;

      return claims;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new JwtError('token_expired', 'Refresh token has expired');
      }
      throw new JwtError('invalid_token', 'Invalid refresh token');
    }
  }

  signAccessToken(userId: string, sessionId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const claims: AccessTokenClaims = {
      sub: userId,
      session_id: sessionId,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL_SECONDS,
      aud: JWT_AUDIENCE,
    };
    return jwt.sign(claims, this.secret, { algorithm: 'HS256' });
  }

  signRefreshToken(userId: string, sessionId: string, jti: string): string {
    const now = Math.floor(Date.now() / 1000);
    const claims: RefreshTokenClaims = {
      sub: userId,
      session_id: sessionId,
      jti,
      iat: now,
      exp: now + REFRESH_TOKEN_TTL_DAYS * 86400,
      aud: JWT_AUDIENCE,
    };
    return jwt.sign(claims, this.secret, { algorithm: 'HS256' });
  }
}

export class JwtError extends Error {
  constructor(
    public readonly code: 'invalid_token' | 'token_expired' | 'session_revoked',
    message: string,
  ) {
    super(message);
    this.name = 'JwtError';
  }
}
