import { Body, Controller, Get, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicUser } from '../common/utils/public-user';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: '用户注册', description: '使用用户名、密码、昵称注册新用户。' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '注册成功',
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
            lastLoginAt: null,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '用户名已被占用',
    schema: {
      example: { success: false, error: { code: 'USERNAME_TAKEN', message: '用户名已被占用' } },
    },
  })
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return { user };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: '用户登录', description: '使用用户名、密码登录，返回 JWT 访问令牌。' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '登录成功',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx.yyy',
          tokenType: 'Bearer',
          expiresIn: 604799,
          user: {
            id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
            username: 'zhangsan',
            nickname: '张三',
            avatar: null,
            role: 'USER',
            status: 'ACTIVE',
            createdAt: '2026-08-15T04:10:20.000Z',
            lastLoginAt: '2026-08-15T05:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '用户名或密码错误',
    schema: {
      example: {
        success: false,
        error: { code: 'UNAUTHORIZED', message: '用户名或密码错误' },
      },
    },
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前登录用户', description: '返回当前登录用户的信息。' })
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
            lastLoginAt: '2026-08-15T05:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未登录 / 凭证无效或过期 / 账号被禁用',
    schema: {
      example: {
        success: false,
        error: { code: 'UNAUTHORIZED', message: '未登录或凭证缺失' },
      },
    },
  })
  async me(@CurrentUser() user: PublicUser) {
    return { user };
  }
}
