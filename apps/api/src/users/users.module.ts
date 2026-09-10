import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { FollowsController } from './follows.controller';
import { UsersService } from './users.service';
import { FollowsService } from './follows.service';

@Module({
  controllers: [UsersController, FollowsController],
  providers: [UsersService, FollowsService],
  exports: [UsersService, FollowsService],
})
export class UsersModule {}
