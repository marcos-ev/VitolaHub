import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Wrapper de conveniência: soft delete deve ser a norma (seção 4), nunca
  // exclusão física. Módulos de feature devem preferir estes helpers a
  // `delete` bruto sempre que o modelo tiver `deletedAt`.
  softDeleteWhereClause() {
    return { deletedAt: null };
  }
}
