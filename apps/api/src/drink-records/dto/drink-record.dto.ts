import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateDrinkRecordDto {
  @ApiProperty({ example: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f', description: '酒品 ID' })
  @IsUUID('4', { message: 'productId 必须是合法的 UUID' })
  productId!: string;

  @ApiProperty({
    example: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
    description: '实际饮用者用户 ID。普通成员只能填写自己，OWNER 可填写房间成员',
  })
  @IsUUID('4', { message: 'userId 必须是合法的 UUID' })
  userId!: string;

  @ApiProperty({ example: 1, description: '数量，支持小数（如 0.5），必须 > 0 且 <= 100' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '数量必须是数字（最多 2 位小数）' })
  @Min(0.01, { message: '数量必须大于 0' })
  @Max(100, { message: '数量不能超过 100' })
  quantity!: number;
}

export class UpdateDrinkRecordDto {
  @ApiPropertyOptional({
    example: 0.5,
    description: '数量，支持小数（如 0.5），必须 > 0 且 <= 100',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '数量必须是数字（最多 2 位小数）' })
  @Min(0.01, { message: '数量必须大于 0' })
  @Max(100, { message: '数量不能超过 100' })
  quantity?: number;

  @ApiPropertyOptional({
    example: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
    description: '实际饮用者用户 ID（需权限，普通成员只能改成自己）',
  })
  @IsOptional()
  @IsUUID('4', { message: 'userId 必须是合法的 UUID' })
  userId?: string;
}
