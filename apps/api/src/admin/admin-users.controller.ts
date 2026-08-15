import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PublicUser } from '../common/utils/public-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { AdminUsersService } from './admin-users.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

const USER_EXAMPLE = {
  id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
  username: 'zhangsan',
  nickname: '张三',
  avatar: null,
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-08-15T04:10:20.000Z',
  lastLoginAt: null,
  deletedAt: null,
};

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({
    summary: '用户列表（管理员）',
    description: '分页返回用户，支持按 username / nickname 关键词搜索，不返回 passwordHash。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: { success: true, data: { items: [USER_EXAMPLE], total: 1, page: 1, pageSize: 20 } },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: '无管理员权限',
    schema: { example: { success: false, error: { code: 'FORBIDDEN', message: '无管理员权限' } } },
  })
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.adminUsersService.list({
      page: page !== undefined ? Number(page) : undefined,
      pageSize: pageSize !== undefined ? Number(pageSize) : undefined,
      keyword,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: '用户详情（管理员）',
    description: '按 ID 查询用户，含参与房间数与饮酒记录数。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: { example: { success: true, data: { user: { ...USER_EXAMPLE, roomCount: 3, drinkRecordCount: 5 } } } },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '用户不存在',
    schema: {
      example: { success: false, error: { code: 'USER_NOT_FOUND', message: '用户不存在' } },
    },
  })
  async getById(@Param('id') id: string) {
    const user = await this.adminUsersService.getById(id);
    return { user };
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: '修改用户状态（管理员）',
    description: '设置 ACTIVE / DISABLED；不能禁用自己。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '修改成功',
    schema: { example: { success: true, data: { user: { ...USER_EXAMPLE, status: 'DISABLED' } } } },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '用户不存在',
    schema: {
      example: { success: false, error: { code: 'USER_NOT_FOUND', message: '用户不存在' } },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: '无管理员权限 / 不能禁用自己',
    schema: {
      example: { success: false, error: { code: 'CANNOT_DISABLE_SELF', message: '不能禁用自己' } },
    },
  })
  async updateStatus(
    @CurrentUser() admin: PublicUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() request: Request,
  ) {
    const user = await this.adminUsersService.updateStatus(admin.id, id, dto, request);
    return { user };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary: '删除用户（仅超级管理员）',
    description:
      '不能删除自己，不能删除 SUPER_ADMIN；存在历史饮酒记录或自有房间时改为软删除（deletedAt + DISABLED），否则物理删除。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '删除成功',
    schema: {
      example: {
        success: true,
        data: { deleted: true, softDeleted: false },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: '仅超级管理员 / 不能删除自己或超级管理员',
    schema: {
      example: {
        success: false,
        error: { code: 'CANNOT_DELETE_SUPER_ADMIN', message: '不能删除超级管理员' },
      },
    },
  })
  async delete(
    @CurrentUser() admin: PublicUser,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.adminUsersService.delete(admin.id, id, request);
  }
}
