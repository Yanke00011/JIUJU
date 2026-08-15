import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Room } from '@prisma/client';
import { PublicUser } from '../common/utils/public-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JoinRoomDto } from './dto/join-room.dto';
import { RoomMembersService } from './room-members.service';

@ApiTags('room-members')
@ApiBearerAuth()
@Controller('rooms')
export class RoomMembersController {
  constructor(private readonly roomMembersService: RoomMembersService) {}

  @Post('join')
  @ApiOperation({ summary: '通过邀请码加入房间', description: '使用邀请码加入一个进行中的房间。' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '加入成功',
    schema: {
      example: {
        success: true,
        data: {
          room: {
            id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
            name: '周末朋友酒局',
            inviteCode: 'A7K92P',
            status: 'ACTIVE',
          },
          member: {
            userId: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
            role: 'MEMBER',
            joinedAt: '2026-08-15T05:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '房间不存在或邀请码无效',
    schema: {
      example: {
        success: false,
        error: { code: 'ROOM_NOT_FOUND', message: '房间不存在' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '房间已结束 / 已是成员',
    schema: {
      example: {
        success: false,
        error: { code: 'ALREADY_MEMBER', message: '你已在该房间中' },
      },
    },
  })
  async joinRoom(@CurrentUser() user: PublicUser, @Body() dto: JoinRoomDto) {
    const result = await this.roomMembersService.joinRoom(user.id, dto.inviteCode);
    return {
      room: this.toRoomSummary(result.room),
      member: result.member,
    };
  }

  @Get(':id/members')
  @ApiOperation({
    summary: '房间成员列表',
    description: '仅房间成员可查看，OWNER 排最前，然后按加入时间排序。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: {
        success: true,
        data: {
          items: [
            {
              userId: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
              nickname: '张三',
              avatar: null,
              role: 'OWNER',
              joinedAt: '2026-08-15T04:10:20.000Z',
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '房间不存在或非成员',
    schema: {
      example: {
        success: false,
        error: { code: 'ROOM_NOT_FOUND', message: '房间不存在' },
      },
    },
  })
  async listMembers(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    const items = await this.roomMembersService.listMembers(user.id, id);
    return { items };
  }

  @Get(':id/members/me')
  @ApiOperation({ summary: '我的成员信息', description: '返回当前用户在该房间的成员信息。' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: {
        success: true,
        data: {
          member: {
            userId: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
            role: 'MEMBER',
            joinedAt: '2026-08-15T05:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '房间不存在或非成员',
    schema: {
      example: {
        success: false,
        error: { code: 'ROOM_NOT_FOUND', message: '房间不存在' },
      },
    },
  })
  async getMyMembership(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    const member = await this.roomMembersService.getMyMembership(user.id, id);
    return { member };
  }

  @Post(':id/members/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '退出房间',
    description: '普通成员可退出；房主不能退出（只能结束房间）。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '退出成功',
    schema: {
      example: { success: true, data: {} },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '房主不能退出 / 房间已结束',
    schema: {
      example: {
        success: false,
        error: { code: 'OWNER_CANNOT_LEAVE', message: '房主不能退出自己的房间，只能结束房间' },
      },
    },
  })
  async leaveRoom(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    await this.roomMembersService.leaveRoom(user.id, id);
    return {};
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '移除成员', description: '仅房主可移除普通成员；不能移除房主。' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '移除成功',
    schema: {
      example: { success: true, data: {} },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: '只有房主才能移除成员',
    schema: {
      example: {
        success: false,
        error: { code: 'ROOM_NOT_OWNER', message: '只有房主才能移除成员' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '不能移除房主 / 房间已结束',
    schema: {
      example: {
        success: false,
        error: { code: 'CANNOT_REMOVE_OWNER', message: '不能移除房主' },
      },
    },
  })
  async removeMember(
    @CurrentUser() user: PublicUser,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    await this.roomMembersService.removeMember(user.id, id, targetUserId);
    return {};
  }

  private toRoomSummary(room: Room): {
    id: string;
    name: string;
    inviteCode: string;
    status: Room['status'];
  } {
    return {
      id: room.id,
      name: room.name,
      inviteCode: room.inviteCode,
      status: room.status,
    };
  }
}
