import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../common/exceptions/business.exception';
import { SuperAdminGuard } from './super-admin.guard';

const buildContext = (user?: { role?: string }) => ({
  switchToHttp: () => ({
    getRequest: () => ({ user: user ?? null }),
  }),
});

describe('SuperAdminGuard', () => {
  let guard: SuperAdminGuard;

  beforeEach(() => {
    guard = new SuperAdminGuard();
  });

  it('should allow SUPER_ADMIN', () => {
    expect(guard.canActivate(buildContext({ role: 'SUPER_ADMIN' }) as never)).toBe(true);
  });

  it('should reject ADMIN with 403 SUPER_ADMIN_REQUIRED', () => {
    let error: unknown;
    try {
      guard.canActivate(buildContext({ role: 'ADMIN' }) as never);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(BusinessException);
    const ex = error as BusinessException;
    expect(ex.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(ex.getResponse()).toEqual({
      code: 'SUPER_ADMIN_REQUIRED',
      message: '仅超级管理员可执行此操作',
    });
  });

  it('should reject missing user', () => {
    expect(() => guard.canActivate(buildContext() as never)).toThrow(BusinessException);
  });
});
