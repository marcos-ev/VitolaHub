import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

function buildContext(user: { id: string } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    guard = new AdminGuard(prisma as never);
  });

  it('nega acesso quando não há usuário autenticado na requisição', async () => {
    await expect(guard.canActivate(buildContext(undefined))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('nega acesso (ForbiddenException) quando o usuário autenticado não é admin', async () => {
    prisma.user.findUnique.mockResolvedValue({ isAdmin: false });

    await expect(guard.canActivate(buildContext({ id: 'user-1' }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' }, select: { isAdmin: true } });
  });

  it('nega acesso quando o usuário não é encontrado no banco', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(buildContext({ id: 'user-1' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite acesso quando o usuário autenticado é admin', async () => {
    prisma.user.findUnique.mockResolvedValue({ isAdmin: true });

    await expect(guard.canActivate(buildContext({ id: 'admin-1' }))).resolves.toBe(true);
  });
});
