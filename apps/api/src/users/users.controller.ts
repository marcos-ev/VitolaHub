import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser, OptionalCurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetPrivacyDto } from './dto/set-privacy.dto';

@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Rotas fixas (`search`, `suggested`) precisam vir ANTES de `:username` no
  // registro de rotas do Nest, senão o Nest tentaria resolvê-las como um
  // username literal ("search", "suggested").
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('search')
  search(@Query('q') query: string, @OptionalCurrentUser() user: RequestUser | null) {
    if (!query || query.trim().length < 2) return [];
    return this.usersService.search(query.trim(), user?.id ?? null);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('suggested')
  suggested(@OptionalCurrentUser() user: RequestUser | null) {
    return this.usersService.suggested(user?.id ?? null);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':username')
  getProfile(@Param('username') username: string, @OptionalCurrentUser() user: RequestUser | null) {
    return this.usersService.getProfileByUsername(username, user?.id ?? null);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('me/privacy')
  setPrivacy(@CurrentUser() user: RequestUser, @Body() dto: SetPrivacyDto) {
    return this.usersService.setPrivacy(user.id, dto.isPrivate);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: RequestUser) {
    await this.usersService.deleteAccount(user.id);
  }
}
