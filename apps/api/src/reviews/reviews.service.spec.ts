import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CountersService } from '../queue/counters.service';
import { DomainEventsService } from '../queue/domain-events.service';
import { DomainEvent } from '../queue/queue.constants';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: {
    cigar: { findFirst: jest.Mock };
    post: { findFirst: jest.Mock };
    review: { findFirst: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let counters: { recomputeCigarRating: jest.Mock };
  let domainEvents: { publish: jest.Mock };
  let tx: { review: { create: jest.Mock }; reviewFlavorNote: { createMany: jest.Mock } };

  const baseDto = {
    cigarId: 'cigar-1',
    rating: 4,
    perceivedStrength: 3,
  };

  const cigar = { id: 'cigar-1', countryCode: 'CU', vitola: 'Robusto', deletedAt: null };

  const reviewWithRelations = {
    id: 'review-1',
    userId: 'user-1',
    cigarId: 'cigar-1',
    postId: null,
    rating: new Prisma.Decimal(4),
    perceivedStrength: 3,
    smokeMinutes: null,
    draw: null,
    burn: null,
    body: null,
    pairedWith: null,
    reviewDate: new Date('2026-08-02'),
    createdAt: new Date('2026-08-02T12:00:00Z'),
    user: { id: 'user-1', username: 'fulano', displayName: 'Fulano', avatarUrl: null },
    cigar: { id: 'cigar-1', name: 'Cohiba', line: null, countryCode: 'CU', vitola: 'Robusto', brand: { id: 'brand-1', name: 'Cohiba' } },
    flavorNotes: [],
  };

  beforeEach(async () => {
    tx = {
      review: { create: jest.fn().mockResolvedValue({ id: 'review-1' }) },
      reviewFlavorNote: { createMany: jest.fn() },
    };
    prisma = {
      cigar: { findFirst: jest.fn().mockResolvedValue(cigar) },
      post: { findFirst: jest.fn() },
      review: { findFirst: jest.fn().mockResolvedValue(reviewWithRelations), findMany: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb: (tx: unknown) => unknown) => cb(tx)),
    };
    counters = { recomputeCigarRating: jest.fn() };
    domainEvents = { publish: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CountersService, useValue: counters },
        { provide: DomainEventsService, useValue: domainEvents },
      ],
    }).compile();

    service = moduleRef.get(ReviewsService);
  });

  describe('create', () => {
    it('lança BadRequestException quando a nota não é inteira nem meio ponto', async () => {
      await expect(service.create('user-1', { ...baseDto, rating: 3.3 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('aceita nota com meio ponto (ex: 3.5)', async () => {
      await service.create('user-1', { ...baseDto, rating: 3.5 });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('lança NotFoundException quando o charuto não existe', async () => {
      prisma.cigar.findFirst.mockResolvedValue(null);
      await expect(service.create('user-1', baseDto)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('traduz violação de unicidade (P2002) em ConflictException 409 — uma avaliação por dia', async () => {
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.20.0',
        }),
      );

      await expect(service.create('user-1', baseDto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('grava reviewDate truncado para a data corrente (meia-noite UTC)', async () => {
      await service.create('user-1', baseDto);
      const createCall = tx.review.create.mock.calls[0][0];
      const savedDate: Date = createCall.data.reviewDate;
      expect(savedDate.getUTCHours()).toBe(0);
      expect(savedDate.getUTCMinutes()).toBe(0);
      expect(savedDate.getUTCSeconds()).toBe(0);
    });

    it('cria as notas de sabor vinculadas quando flavorNoteIds é informado', async () => {
      await service.create('user-1', { ...baseDto, flavorNoteIds: ['fn-1', 'fn-2'] });
      expect(tx.reviewFlavorNote.createMany).toHaveBeenCalledWith({
        data: [
          { reviewId: 'review-1', flavorNoteId: 'fn-1' },
          { reviewId: 'review-1', flavorNoteId: 'fn-2' },
        ],
      });
    });

    it('publica REVIEW_CREATED com país/vitola do charuto e recalcula o rating após o commit', async () => {
      await service.create('user-1', baseDto);

      expect(domainEvents.publish).toHaveBeenCalledWith(DomainEvent.REVIEW_CREATED, {
        userId: 'user-1',
        reviewId: 'review-1',
        cigarId: 'cigar-1',
        cigarCountryCode: 'CU',
        cigarVitola: 'Robusto',
      });
      expect(counters.recomputeCigarRating).toHaveBeenCalledWith('cigar-1');
    });

    it('exige que o post pertença ao autor quando postId é informado', async () => {
      prisma.post.findFirst.mockResolvedValue(null);
      await expect(service.create('user-1', { ...baseDto, postId: 'post-1' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findById', () => {
    it('lança NotFoundException quando a avaliação não existe', async () => {
      prisma.review.findFirst.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('devolve a avaliação mapeada com nota numérica', async () => {
      const result = await service.findById('review-1');
      expect(result.rating).toBe(4);
      expect(result.cigar.brand).toEqual({ id: 'brand-1', name: 'Cohiba' });
    });
  });
});
