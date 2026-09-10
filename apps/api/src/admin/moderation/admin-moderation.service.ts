import { Injectable, NotFoundException } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CursorPage, DEFAULT_PAGE_SIZE, decodeCursor, paginateResults } from '../../common/pagination/cursor.util';
import { ListReportsDto } from './dto/list-reports.dto';

/**
 * Fila de moderação (seção "admin/"): denúncias (`Report`), remoção de
 * conteúdo denunciado e suspensão de usuários. Duas observações de mapeamento
 * assumidas (documentadas também no resumo final da tarefa):
 *
 * - `resolve` grava `ReportStatus.REVIEWED` — "a denúncia foi analisada e
 *   tratada" (o enum do schema não tem um valor literal `RESOLVED`/`CLOSED`).
 *   Se a análise resultou em remoção de conteúdo ou suspensão de usuário,
 *   isso é feito por chamadas separadas (`DELETE /admin/posts/:id`,
 *   `POST /admin/users/:id/suspend`) — não há transição automática aqui.
 * - `dismiss` grava `ReportStatus.DISMISSED`, que já existe com esse nome
 *   exato no enum.
 */
@Injectable()
export class AdminModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async listReports(query: ListReportsDto): Promise<CursorPage<unknown>> {
    const cursor = decodeCursor(query.cursor);

    const reports = await this.prisma.report.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: DEFAULT_PAGE_SIZE + 1,
      include: {
        reporter: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    return paginateResults(reports, DEFAULT_PAGE_SIZE);
  }

  private async findReportOrThrow(id: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Denúncia não encontrada');
    return report;
  }

  async resolve(id: string) {
    await this.findReportOrThrow(id);
    return this.prisma.report.update({
      where: { id },
      data: { status: ReportStatus.REVIEWED },
    });
  }

  async dismiss(id: string) {
    await this.findReportOrThrow(id);
    return this.prisma.report.update({
      where: { id },
      data: { status: ReportStatus.DISMISSED },
    });
  }

  // Reaproveita a mesma regra de soft delete de `PostsService.softDelete`
  // (`deletedAt: new Date()`), acionada aqui pelo admin em vez do autor.
  async removePost(postId: string) {
    const post = await this.prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException('Post não encontrado');

    return this.prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
  }

  async suspendUser(userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
    });
  }

  async unsuspendUser(userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });
  }
}
