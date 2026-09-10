import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../guards/admin.guard';
import { AdminCigarsService } from './admin-cigars.service';
import { ListPendingCigarsDto } from './dto/list-pending-cigars.dto';
import { RejectCigarDto } from './dto/reject-cigar.dto';
import { UpdateCigarDto } from './dto/update-cigar.dto';

@UseGuards(AdminGuard)
@Controller({ path: 'admin/cigars', version: '1' })
export class AdminCigarsController {
  constructor(private readonly adminCigarsService: AdminCigarsService) {}

  @Get('pending')
  listPending(@Query() query: ListPendingCigarsDto) {
    return this.adminCigarsService.listPending(query.cursor);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.adminCigarsService.approve(id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectCigarDto) {
    return this.adminCigarsService.reject(id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCigarDto) {
    return this.adminCigarsService.update(id, dto);
  }
}
