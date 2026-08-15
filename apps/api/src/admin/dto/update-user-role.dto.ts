import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateUserRoleDto {
  @ApiProperty({
    example: 'ADMIN',
    enum: ['USER', 'ADMIN'],
    description: '目标角色：仅允许 USER ↔ ADMIN；禁止设置为 SUPER_ADMIN',
  })
  @IsIn(['USER', 'ADMIN'], { message: '角色只能是 USER 或 ADMIN' })
  role!: 'USER' | 'ADMIN';
}
