import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { customAlphabet } from 'nanoid';
import { TRIAL_DAYS } from '@charuto/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenService } from './token.service';

const inviteCodeAlphabet = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

function calculateAge(birthDate: Date, at: Date = new Date()): number {
  let age = at.getFullYear() - birthDate.getFullYear();
  const monthDiff = at.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function assertTaxIdForAccountType(taxId: string, accountType: 'PF' | 'PJ') {
  const digits = onlyDigits(taxId);
  if (accountType === 'PF' && digits.length !== 11) {
    throw new BadRequestException('Pessoa física precisa informar um CPF válido');
  }
  if (accountType === 'PJ' && digits.length !== 14) {
    throw new BadRequestException('Lojista precisa informar um CNPJ válido');
  }
  return digits;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.acceptedTerms) {
      throw new BadRequestException('É necessário aceitar os termos e a política de privacidade');
    }

    const birthDate = new Date(dto.birthDate);
    if (Number.isNaN(birthDate.getTime())) {
      throw new BadRequestException('Data de nascimento inválida');
    }

    // Restrição de acesso inegociável (seção 1 e 9): bloqueio de contas menores de 18.
    if (calculateAge(birthDate) < 18) {
      throw new ForbiddenException('É necessário ter 18 anos ou mais para usar o Vitola Hub');
    }

    const taxId = assertTaxIdForAccountType(dto.taxId, dto.accountType);
    const username = dto.username.trim().toLowerCase();
    // Cadastro manual sem obrigar e-mail: se o cliente não enviar, geramos um
    // identificador interno estável a partir do username (login funciona por
    // username). Contato real pode ser adicionado depois nas configurações.
    const email = (dto.email?.trim().toLowerCase() || `${username}@users.vitolahub.app`);

    const [emailTaken, usernameTaken, taxTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.user.findUnique({ where: { username } }),
      this.prisma.user.findUnique({ where: { taxId } }),
    ]);
    if (emailTaken) throw new ConflictException('E-mail já cadastrado');
    if (usernameTaken) throw new ConflictException('Nome de usuário já em uso');
    if (taxTaken) throw new ConflictException(dto.accountType === 'PJ' ? 'CNPJ já cadastrado' : 'CPF já cadastrado');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    // Um teste por conta e por dispositivo (seção 6.3): se este installationId
    // já usou o trial antes, a nova conta nasce direto no plano gratuito.
    const deviceAlreadyTrialed = dto.installationId
      ? await this.prisma.user.findFirst({
          where: { installationId: dto.installationId, trialStartedAt: { not: null } },
          select: { id: true },
        })
      : null;

    const now = new Date();
    const grantsTrial = !deviceAlreadyTrialed;

    const invite = dto.inviteCode
      ? await this.prisma.invite.findUnique({ where: { code: dto.inviteCode.toUpperCase() } })
      : null;
    if (dto.inviteCode && (!invite || invite.usedBy)) {
      throw new BadRequestException('Código de convite inválido ou já utilizado');
    }

    const newInviteCode = inviteCodeAlphabet();

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          username,
          displayName: dto.displayName.trim(),
          birthDate,
          taxId,
          accountType: dto.accountType,
          installationId: dto.installationId,
          inviteCode: newInviteCode,
          invitedByUserId: invite?.inviterId,
          trialStartedAt: grantsTrial ? now : null,
          trialEndsAt: grantsTrial ? new Date(now.getTime() + TRIAL_DAYS * 86_400_000) : null,
          subscriptionStatus: grantsTrial ? 'TRIALING' : 'NONE',
        },
      });

      // Todo usuário tem um código de convite permanente (seção 5.5) — a linha
      // em `Invite` é o que permite tanto redimir (`findUnique` por código)
      // quanto contar quantos convites essa pessoa já converteu.
      await tx.invite.create({ data: { code: newInviteCode, inviterId: created.id } });

      // Convite (seção 5.5): convidador e convidado entram como amigos direto,
      // com solicitação pré-aceita nos dois sentidos.
      if (invite) {
        await tx.follow.createMany({
          data: [
            { followerId: created.id, followeeId: invite.inviterId, status: 'ACCEPTED' },
            { followerId: invite.inviterId, followeeId: created.id, status: 'ACCEPTED' },
          ],
        });
        await tx.invite.update({
          where: { code: invite.code },
          data: { usedBy: created.id, usedAt: now },
        });
        await tx.notification.create({
          data: {
            userId: invite.inviterId,
            type: 'INVITE_ACCEPTED',
            actorId: created.id,
          },
        });
      }

      return created;
    });

    return this.issueSession(user.id, user.username);
  }

  async login(dto: LoginDto) {
    const raw = (dto.identifier ?? dto.email ?? '').trim();
    if (!raw) throw new UnauthorizedException('Informe usuário ou e-mail e a senha');

    const isEmail = raw.includes('@');
    const user = isEmail
      ? await this.prisma.user.findUnique({ where: { email: raw.toLowerCase() } })
      : await this.prisma.user.findUnique({ where: { username: raw.toLowerCase() } });

    if (!user || !user.passwordHash || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuário ou senha inválidos');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Usuário ou senha inválidos');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });

    return this.issueSession(user.id, user.username);
  }

  async refresh(refreshToken: string) {
    const { userId, refreshToken: newRefreshToken } = await this.tokens.rotateRefreshToken(refreshToken);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Sessão inválida');

    return {
      accessToken: this.tokens.signAccessToken({ sub: user.id, username: user.username }),
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    await this.tokens.revokeRefreshToken(refreshToken);
  }

  private async issueSession(userId: string, username: string) {
    const accessToken = this.tokens.signAccessToken({ sub: userId, username });
    const refreshToken = await this.tokens.issueRefreshToken(userId);
    return { accessToken, refreshToken };
  }
}
