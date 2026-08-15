import { Body, Controller, Get, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicUser } from '../common/utils/public-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { UserService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前登录用户', description: '返回当前登录用户的资料。' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: {
        success: true,
        data: {
          user: {
            id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
            username: 'zhangsan',
            nickname: '张三',
            avatar: null,
            role: 'USER',
            status: 'ACTIVE',
            createdAt: '2026-08-15T04:10:20.000Z',
            updatedAt: '2026-08-15T04:10:20.000Z',
            lastLoginAt: null,
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
  async getMe(@CurrentUser() user: PublicUser) {
    const fresh = await this.userService.getMe(user.id);
    return { user: fresh };
  }

  @Patch('me')
  @ApiOperation({ summary: '修改个人资料', description: '允许修改 nickname 与 avatar。' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '修改成功',
    schema: {
      example: {
        success: true,
        data: {
          user: {
            id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
            username: 'zhangsan',
            nickname: '张三',
            avatar: 'https://example.com/avatar.jpg',
            role: 'USER',
            status: 'ACTIVE',
            createdAt: '2026-08-15T04:10:20.000Z',
            updatedAt: '2026-08-15T05:00:00.000Z',
            lastLoginAt: null,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '参数校验失败',
    schema: {
      example: {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '昵称最多 50 个字符' },
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
  async updateMe(@CurrentUser() user: PublicUser, @Body() dto: UpdateMeDto) {
    const fresh = await this.userService.updateMe(user.id, dto);
    return { user: fresh };
  }
}
