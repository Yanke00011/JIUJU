import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class BatchDeleteProductsDto {
  @ApiProperty({
    example: ['b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f'],
    description: '要删除的商品 ID 列表',
    type: [String],
  })
  @IsArray({ message: 'ids 必须是数组' })
  @ArrayNotEmpty({ message: 'ids 不能为空' })
  @IsUUID('4', { each: true, message: 'ids 中的每一项必须是合法的 UUID' })
  ids!: string[];
}
