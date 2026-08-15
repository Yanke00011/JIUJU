import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'zhangsan',
    description: '用户名：3-32 个字符，仅允许字母、数字、下划线、连字符',
  })
  @IsString({ message: '用户名必须是字符串' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(3, { message: '用户名长度至少 3 个字符' })
  @MaxLength(32, { message: '用户名长度最多 32 个字符' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: '用户名只能包含字母、数字、下划线和连字符',
  })
  username!: string;

  @ApiProperty({
    example: 'Password123',
    description: '密码：8-128 位，至少包含一个字母和一个数字',
  })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(8, { message: '密码长度至少 8 位' })
  @MaxLength(128, { message: '密码长度最多 128 位' })
  @Matches(/[a-zA-Z]/, { message: '密码至少包含一个字母' })
  @Matches(/[0-9]/, { message: '密码至少包含一个数字' })
  password!: string;

  @ApiProperty({ example: '张三', description: '昵称：1-50 个字符' })
  @IsString({ message: '昵称必须是字符串' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1, { message: '昵称不能为空' })
  @MaxLength(50, { message: '昵称最多 50 个字符' })
  nickname!: string;
}
