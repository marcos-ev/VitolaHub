import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CountersService } from '../queue/counters.service';
import { DomainEventsService } from '../queue/domain-events.service';
import { DomainEvent } from '../queue/queue.constants';
import { CursorPage, DEFAULT_PAGE_SIZE, decodeCursor, paginateResults } from '../common/pagination/cursor.util';
import { CreateReviewDto } from './dto/create-review.dto';

const reviewInclude = {
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  cigar: { include: { brand: true } },
  flavorNotes: { include: { flavorNote: true } },
} satisfies Prisma.ReviewInclude;

type ReviewWithRelations = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

function toDto(review: ReviewWithRelations) {
  return {
    id: review.id,
    userId: review.userId,
    user: review.user,
    cigarId: review.cigarId,
    cigar: {
      id: review.cigar.id,
      name: review.cigar.name,
      line: review.cigar.line,
      brand: { id: review.cigar.brand.id, name: review.cigar.brand.name },
      countryCode: review.cigar.countryCode,
      vitola: review.cigar.vitola,
    },
    postId: review.postId,
    rating: Number(review.rating),
    perceivedStrength: review.perceivedStrength,
    smokeMinutes: review.smokeMinutes,
    draw: review.draw,
    burn: review.burn,
    body: review.body,
    pairedWith: review.pairedWith,
    flavorNotes: review.flavorNotes.map((fn) => ({ id: fn.flavorNote.id, name: fn.flavorNote.name })),
    reviewDate: review.reviewDate,
    createdAt: review.createdAt,
  };
}

/** Trunca para meia-noite UTC — a granularidade de "um dia" da regra de unicidade. */
function truncateToDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Avaliações estruturadas (seção 5.3 e schema `Review`). Regra central:
 * `@@unique([userId, cigarId, reviewDate])` no schema implementa "uma
 * avaliação por charuto por usuário por dia" — sempre gravamos `reviewDate`
 * truncado para a data corrente (meia-noite UTC) e traduzimos a violação de
 * unicidade do Postgres (P2002) em 409 Conflict.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: CountersService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  async create(userId: string, dto: CreateReviewDto) {
    if ((dto.rating * 2) % 1 !== 0) {
      throw new BadRequestException('A nota deve ser um número inteiro ou com meio ponto (ex: 3, 3.5, 4)');
    }

    const cigar = await this.prisma.cigar.findFirst({ where: { id: dto.cigarId, deletedAt: null } });
    if (!cigar) throw new NotFoundException('Charuto não encontrado');

    if (dto.postId) {
      const post = await this.prisma.post.findFirst({ where: { id: dto.postId, deletedAt: null, authorId: userId } });
      if (!post) throw new NotFoundException('Post não encontrado');
    }

    const reviewDate = truncateToDate(new Date());

    let reviewId: string;
    try {
      reviewId = await this.prisma.$transaction(async (tx) => {
        const created = await tx.review.create({
          data: {
            userId,
            cigarId: dto.cigarId,
            postId: dto.postId,
            rating: dto.rating,
            perceivedStrength: dto.perceivedStrength,
            smokeMinutes: dto.smokeMinutes,
            draw: dto.draw,
            burn: dto.burn,
            body: dto.body,
            pairedWith: dto.pairedWith,
            reviewDate,
          },
        });

        if (dto.flavorNoteIds?.length) {
          await tx.reviewFlavorNote.createMany({
            data: dto.flavorNoteIds.map((flavorNoteId) => ({ reviewId: created.id, flavorNoteId })),
          });
        }

        return created.id;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Você já avaliou este charuto hoje');
      }
      throw err;
    }

    // Publicado somente depois da transação confirmar — nunca antes.
    await this.domainEvents.publish(DomainEvent.REVIEW_CREATED, {
      userId,
      reviewId,
      cigarId: dto.cigarId,
      cigarCountryCode: cigar.countryCode,
      cigarVitola: cigar.vitola,
    });
    await this.counters.recomputeCigarRating(dto.cigarId);

    return this.findById(reviewId);
  }

  async findById(id: string) {
    const review = await this.prisma.review.findFirst({
      where: { id, deletedAt: null },
      include: reviewInclude,
    });
    if (!review) throw new NotFoundException('Avaliação não encontrada');
    return toDto(review);
  }

  async listByCigar(cigarId: string, cursorRaw?: string): Promise<CursorPage<ReturnType<typeof toDto>>> {
    const cursor = decodeCursor(cursorRaw);
    const reviews = await this.prisma.review.findMany({
      where: {
        cigarId,
        deletedAt: null,
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
      include: reviewInclude,
    });

    const page = paginateResults(reviews, DEFAULT_PAGE_SIZE);
    return { items: page.items.map(toDto), nextCursor: page.nextCursor };
  }
}
