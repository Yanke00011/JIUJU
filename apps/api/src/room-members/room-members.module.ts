import { Module } from '@nestjs/common';
import { RoomMembersController } from './room-members.controller';
import { RoomMembersService } from './room-members.service';

@Module({
  controllers: [RoomMembersController],
  providers: [RoomMembersService],
  exports: [RoomMembersService],
})
export class RoomMembersModule {}
