import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

/**
 * 更新个人资料 DTO。
 * 仅允许修改 nickname / avatar；username、role、status、passwordHash 等一律不允许修改。
 */
export class UpdateMeDto {
  @ApiPropertyOptional({
    example: '张三',
    description: '昵称：1-50 个字符',
  })
  @IsOptional()
  @IsString({ message: '昵称必须是字符串' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1, { message: '昵称不能为空' })
  @MaxLength(50, { message: '昵称最多 50 个字符' })
  nickname?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    description: '头像 URL：必须是合法的 http(s) URL，最长 500 个字符',
  })
  @IsOptional()
  @IsString({ message: '头像必须是字符串' })
  @IsUrl({ require_protocol: true }, { message: '头像必须是合法的 URL' })
  @MaxLength(500, { message: '头像 URL 最多 500 个字符' })
  avatar?: string;
}
