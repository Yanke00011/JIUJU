import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({
    example: '周末朋友酒局',
    description: '房间名称：1-100 个字符',
  })
  @IsString({ message: '房间名称必须是字符串' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1, { message: '房间名称不能为空' })
  @MaxLength(100, { message: '房间名称最多 100 个字符' })
  name!: string;
}
