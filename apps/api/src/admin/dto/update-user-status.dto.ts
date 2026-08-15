import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({ example: UserStatus.ACTIVE, enum: UserStatus, description: '目标状态' })
  @IsEnum(UserStatus, { message: '状态必须是 ACTIVE 或 DISABLED' })
  status!: UserStatus;
}
