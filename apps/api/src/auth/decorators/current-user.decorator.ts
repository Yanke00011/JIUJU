import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PublicUser } from '../../common/utils/public-user';
import type { AuthenticatedRequest } from '../jwt-auth.guard';

/**
 * 获取当前登录用户。
 * 身份必须来自 JWT（由 JwtAuthGuard 校验并写入 request.user），
 * 绝不能信任 body.userId / query.userId / params.userId。
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user as PublicUser;
  },
);
