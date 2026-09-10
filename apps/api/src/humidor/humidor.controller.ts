import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { HumidorService } from './humidor.service';
import { AddHumidorItemDto } from './dto/add-humidor-item.dto';
import { UpdateHumidorItemDto } from './dto/update-humidor-item.dto';
import { ListHumidorDto } from './dto/list-humidor.dto';

@Controller({ path: 'humidor', version: '1' })
export class HumidorController {
  constructor(private readonly humidorService: HumidorService) {}

  @Post()
  addItem(@CurrentUser() user: RequestUser, @Body() dto: AddHumidorItemDto) {
    return this.humidorService.addItem(user.id, dto);
  }

  @Get('me')
  listMine(@CurrentUser() user: RequestUser, @Query() query: ListHumidorDto) {
    return this.humidorService.listMine(user.id, query.page ?? 1, query.pageSize ?? 20);
  }

  @Patch(':id')
  updateItem(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateHumidorItemDto) {
    return this.humidorService.updateItem(user.id, id, dto);
  }

  @Delete(':id')
  removeItem(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.humidorService.removeItem(user.id, id);
  }
}
