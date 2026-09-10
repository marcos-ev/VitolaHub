import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessTokenPayload {
  sub: string;
  username: string;
}

// JWT de acesso de vida curta (15 min) + refresh token rotativo persistido
// (seção 2). Cada refresh invalida o token anterior e emite um novo,
// detectando reuso de token já rotacionado como possível roubo de sessão.
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issueRefreshToken(userId: string): Promise<string> {
    const created = await this.createRefreshToken(userId);
    return created.raw;
  }

  private async createRefreshToken(userId: string): Promise<{ id: string; raw: string }> {
    const raw = `${userId}.${randomUUID()}.${randomUUID()}`;
    const ttl = this.config.get<string>('JWT_REFRESH_TTL') ?? '30d';
    const expiresAt = new Date(Date.now() + this.parseTtlMs(ttl));

    const created = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(raw),
        expiresAt,
      },
    });

    return { id: created.id, raw };
  }

  async rotateRefreshToken(rawToken: string): Promise<{ userId: string; refreshToken: string }> {
    const tokenHash = this.hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    // `replacedBy` no schema é UUID do novo RefreshToken — nunca o hash SHA-256
    // (64 hex), que quebrava o refresh com "invalid length ... found 64" e
    // deixava o app na tela "Algo deu errado" após os 15 min do access token.
    const next = await this.createRefreshToken(existing.userId);

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedBy: next.id },
    });

    return { userId: existing.userId, refreshToken: next.raw };
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private parseTtlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2];
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 86_400_000;
    return value * unitMs;
  }
}
