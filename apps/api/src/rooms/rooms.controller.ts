import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicUser } from '../common/utils/public-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomService } from './rooms.service';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @ApiOperation({ summary: '创建酒局', description: '创建房间并自动成为 OWNER。' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '创建成功',
    schema: {
      example: {
        success: true,
        data: {
          room: {
            id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
            name: '周末朋友酒局',
            inviteCode: 'A7K92P',
            status: 'ACTIVE',
            ownerId: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
            createdAt: '2026-08-15T04:10:20.000Z',
            endedAt: null,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未登录 / 凭证无效或过期',
    schema: {
      example: {
        success: false,
        error: { code: 'UNAUTHORIZED', message: '未登录或凭证缺失' },
      },
    },
  })
  async createRoom(@CurrentUser() user: PublicUser, @Body() dto: CreateRoomDto) {
    const room = await this.roomService.createRoom(user.id, dto);
    return { room };
  }

  @Get()
  @ApiOperation({ summary: '我的酒局列表', description: '返回当前用户参与的房间。' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: {
        success: true,
        data: {
          items: [
            {
              id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
              name: '周末朋友酒局',
              inviteCode: 'A7K92P',
              status: 'ACTIVE',
              ownerId: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
              createdAt: '2026-08-15T04:10:20.000Z',
              endedAt: null,
            },
          ],
        },
      },
    },
  })
  async listMyRooms(@CurrentUser() user: PublicUser) {
    const rooms = await this.roomService.listMyRooms(user.id);
    return { items: rooms };
  }

  @Get(':id')
  @ApiOperation({ summary: '房间详情', description: '仅房间成员可查看，非成员返回 404。' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: {
        success: true,
        data: {
          room: {
            id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
            name: '周末朋友酒局',
            inviteCode: 'A7K92P',
            status: 'ACTIVE',
            ownerId: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
            createdAt: '2026-08-15T04:10:20.000Z',
            endedAt: null,
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
  async getRoomById(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    const room = await this.roomService.getRoomById(user.id, id);
    return { room };
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '结束酒局', description: '仅房主可结束，结束后不可再结束。' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '结束成功',
    schema: {
      example: {
        success: true,
        data: {
          room: {
            id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
            name: '周末朋友酒局',
            inviteCode: 'A7K92P',
            status: 'ENDED',
            ownerId: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
            createdAt: '2026-08-15T04:10:20.000Z',
            endedAt: '2026-08-15T05:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: '只有房主才能结束房间',
    schema: {
      example: {
        success: false,
        error: { code: 'ROOM_NOT_OWNER', message: '只有房主才能结束房间' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '房间已结束',
    schema: {
      example: {
        success: false,
        error: { code: 'ROOM_ALREADY_ENDED', message: '房间已结束' },
      },
    },
  })
  async endRoom(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    const room = await this.roomService.endRoom(user.id, id);
    return { room };
  }
}
