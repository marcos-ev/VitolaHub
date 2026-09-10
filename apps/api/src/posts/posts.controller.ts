import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, OptionalCurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ReportPostDto } from './dto/report-post.dto';
import { PostsService } from './posts.service';

@Controller({ path: 'posts', version: '1' })
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePostDto) {
    return this.postsService.create(user.id, dto);
  }

  // `GET /posts` faz duplo papel (documentado em `use-posts.ts`/`use-explore.ts`
  // no mobile): com `authorId`, lista a grade de um perfil; com
  // `visibility=PUBLIC` (sem authorId), alimenta a grade de descoberta da tela
  // Explorar — publicações públicas recentes de toda a base, respeitando a
  // mesma camada única de visibilidade (`VisibilityService`).
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list(
    @Query('authorId') authorId: string | undefined,
    @Query('visibility') visibility: string | undefined,
    @OptionalCurrentUser() user: RequestUser | null,
    @Query('cursor') cursor?: string,
  ) {
    if (authorId) return this.postsService.listByAuthor(authorId, user?.id ?? null, cursor);
    if (visibility === 'PUBLIC') return this.postsService.listPublic(user?.id ?? null, cursor);
    throw new BadRequestException('Informe authorId, ou visibility=PUBLIC para descobrir publicações');
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findById(@Param('id') id: string, @OptionalCurrentUser() user: RequestUser | null) {
    return this.postsService.findById(id, user?.id ?? null);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.postsService.softDelete(id, user.id);
  }

  @Post(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  async like(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.postsService.like(id, user.id);
  }

  @Delete(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlike(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.postsService.unlike(id, user.id);
  }

  @Post(':id/comments')
  comment(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: CreateCommentDto) {
    return this.postsService.comment(id, user.id, dto);
  }

  @Delete(':id/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
  ) {
    await this.postsService.deleteComment(id, commentId, user.id);
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  async report(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: ReportPostDto) {
    await this.postsService.report(id, user.id, dto.reason);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/comments')
  listComments(
    @Param('id') id: string,
    @OptionalCurrentUser() user: RequestUser | null,
    @Query('cursor') cursor?: string,
  ) {
    return this.postsService.listComments(id, user?.id ?? null, cursor);
  }
}
