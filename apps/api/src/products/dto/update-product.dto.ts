import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * 更新 Product DTO。
 * 不允许修改 id 与 barcode（barcode 是商品核心身份，V1 不可改）。
 */
export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'XX啤酒', description: '酒品名称：1-100 个字符' })
  @IsOptional()
  @IsString({ message: '酒品名称必须是字符串' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: '酒品名称最多 100 个字符' })
  name?: string;

  @ApiPropertyOptional({ example: 'XX', description: '品牌：0-100 个字符' })
  @IsOptional()
  @IsString({ message: '品牌必须是字符串' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: '品牌最多 100 个字符' })
  brand?: string;

  @ApiPropertyOptional({
    example: ProductCategory.BEER,
    enum: ProductCategory,
    description: '酒品分类',
  })
  @IsOptional()
  @IsEnum(ProductCategory, { message: '分类必须是有效的 ProductCategory' })
  category?: ProductCategory;

  @ApiPropertyOptional({ example: 500, description: '容量（毫升）：1-10000' })
  @IsOptional()
  @IsInt({ message: '容量必须是整数' })
  @Min(1, { message: '容量必须大于 0' })
  @Max(10000, { message: '容量最多 10000 毫升' })
  volumeMl?: number;

  @ApiPropertyOptional({ example: 4.3, description: '酒精度（%）：0-100' })
  @IsOptional()
  @IsNumber({}, { message: '酒精度必须是数字' })
  @Min(0, { message: '酒精度不能小于 0' })
  @Max(100, { message: '酒精度不能大于 100' })
  alcoholPercent?: number;
}
