import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../guards/admin.guard';
import { AdminShopsService } from './admin-shops.service';
import { AssistedShopSignupDto } from './dto/assisted-signup.dto';
import { ListShopsDto } from './dto/list-shops.dto';

@UseGuards(AdminGuard)
@Controller({ path: 'admin/shops', version: '1' })
export class AdminShopsController {
  constructor(private readonly adminShopsService: AdminShopsService) {}

  @Post('assisted-signup')
  assistedSignup(@Body() dto: AssistedShopSignupDto) {
    return this.adminShopsService.assistedSignup(dto);
  }

  @Post(':id/verify')
  verify(@Param('id') id: string) {
    return this.adminShopsService.verify(id);
  }

  @Get()
  list(@Query() query: ListShopsDto) {
    return this.adminShopsService.list(query);
  }
}
