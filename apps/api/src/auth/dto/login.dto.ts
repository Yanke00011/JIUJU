import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'zhangsan', description: '用户名' })
  @IsString({ message: '用户名必须是字符串' })
  username!: string;

  @ApiProperty({ example: 'Password123', description: '密码' })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(1, { message: '密码不能为空' })
  password!: string;
}
