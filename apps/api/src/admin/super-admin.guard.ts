import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { BusinessException } from '../common/exceptions/business.exception';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

/**
 * SUPER_ADMIN 守卫：仅 SUPER_ADMIN 可访问（删除用户 / 删除商品等系统级操作）。
 * 需配合 AdminGuard 使用（先通过 Admin 校验，再校验 SUPER_ADMIN）。
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & Request>();
    const user = request.user;
    if (!user || user.role !== 'SUPER_ADMIN') {
      throw new BusinessException(
        'SUPER_ADMIN_REQUIRED',
        '仅超级管理员可执行此操作',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
