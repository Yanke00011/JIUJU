import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

/**
 * 邀请码字符集与房间生成保持一致：排除容易混淆的 I/O/0/1。
 */
const INVITE_CODE_REGEX = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export class JoinRoomDto {
  @ApiProperty({
    example: 'A7K92P',
    description: '6 位邀请码（字母数字，排除 I/O/0/1），自动 trim 并转换为大写',
  })
  @IsString({ message: '邀请码必须是字符串' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(INVITE_CODE_REGEX, { message: '邀请码必须是 6 位有效的字母或数字' })
  inviteCode!: string;
}
