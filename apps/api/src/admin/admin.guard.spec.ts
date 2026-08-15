import { HttpStatus } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

const buildContext = (user?: { role?: string }) => ({
  switchToHttp: () => ({
    getRequest: () => ({ user: user ?? null }),
  }),
});

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it('should allow SUPER_ADMIN', async () => {
    const allowed = guard.canActivate(buildContext({ role: 'SUPER_ADMIN' }) as never);
    expect(allowed).toBe(true);
  });

  it('should allow ADMIN', async () => {
    const allowed = guard.canActivate(buildContext({ role: 'ADMIN' }) as never);
    expect(allowed).toBe(true);
  });

  it('should reject USER with 403 FORBIDDEN', async () => {
    expect(() => guard.canActivate(buildContext({ role: 'USER' }) as never)).toThrow(
      expect.objectContaining({
        status: HttpStatus.FORBIDDEN,
        response: { code: 'FORBIDDEN', message: '无管理员权限' },
      }),
    );
  });

  it('should reject missing user', async () => {
    expect(() => guard.canActivate(buildContext() as never)).toThrow(
      expect.objectContaining({ status: HttpStatus.FORBIDDEN }),
    );
  });
});
