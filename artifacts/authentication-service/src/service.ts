import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  mfaEnabled: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MFASetup {
  secret: string;
  qrCode: string;
  manualEntryKey: string;
}

export class AuthenticationService {
  private jwtSecret: string;
  private refreshSecret: string;
  private mfaIssuer: string;

  constructor(
    jwtSecret: string = process.env.JWT_SECRET || 'dev-secret',
    refreshSecret: string = process.env.REFRESH_SECRET || 'dev-refresh',
    mfaIssuer: string = process.env.MFA_ISSUER || 'LUMA'
  ) {
    this.jwtSecret = jwtSecret;
    this.refreshSecret = refreshSecret;
    this.mfaIssuer = mfaIssuer;
  }

  /**
   * Hash password with bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(user: AuthUser, expiresIn: string = '24h'): string {
    return jwt.sign(
      {
        userId: user.userId,
        email: user.email,
        fullName: user.fullName,
        type: 'access',
      },
      this.jwtSecret,
      { expiresIn }
    );
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(user: AuthUser, expiresIn: string = '7d'): string {
    return jwt.sign(
      {
        userId: user.userId,
        type: 'refresh',
      },
      this.refreshSecret,
      { expiresIn }
    );
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(user: AuthUser): TokenPair {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400, // 24 hours in seconds
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): AuthUser | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      if (decoded.type !== 'access') {
        return null;
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        fullName: decoded.fullName,
        mfaEnabled: decoded.mfaEnabled || false,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): { userId: string } | null {
    try {
      const decoded = jwt.verify(token, this.refreshSecret) as any;
      if (decoded.type !== 'refresh') {
        return null;
      }

      return { userId: decoded.userId };
    } catch (error) {
      return null;
    }
  }

  /**
   * Setup MFA for user
   */
  async setupMFA(email: string): Promise<MFASetup> {
    const secret = speakeasy.generateSecret({
      name: `${this.mfaIssuer} (${email})`,
      issuer: this.mfaIssuer,
      length: 32,
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCode,
      manualEntryKey: secret.base32,
    };
  }

  /**
   * Verify MFA code
   */
  verifyMFACode(secret: string, token: string): boolean {
    try {
      const isValid = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2, // 2 minute window
      });

      return isValid;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate backup codes for MFA
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase());
    }
    return codes;
  }

  /**
   * Validate backup code
   */
  validateBackupCode(code: string, codes: string[]): boolean {
    return codes.includes(code.toUpperCase());
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }
}
