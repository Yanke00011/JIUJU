import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const BARCODE_REGEX = /^\d{8,14}$/;

export class CreateProductDto {
  @ApiProperty({
    example: '6901234567890',
    description: '条形码：8-14 位数字（EAN-13 / EAN-8 / UPC-A）',
  })
  @IsString({ message: '条形码必须是字符串' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(BARCODE_REGEX, { message: '条形码必须是 8-14 位数字' })
  barcode!: string;

  @ApiProperty({ example: 'XX啤酒', description: '酒品名称：1-100 个字符' })
  @IsString({ message: '酒品名称必须是字符串' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1, { message: '酒品名称不能为空' })
  @MaxLength(100, { message: '酒品名称最多 100 个字符' })
  name!: string;

  @ApiPropertyOptional({ example: 'XX', description: '品牌：0-100 个字符' })
  @IsOptional()
  @IsString({ message: '品牌必须是字符串' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: '品牌最多 100 个字符' })
  brand?: string;

  @ApiProperty({ example: ProductCategory.BEER, enum: ProductCategory, description: '酒品分类' })
  @IsEnum(ProductCategory, { message: '分类必须是有效的 ProductCategory' })
  category!: ProductCategory;

  @ApiProperty({ example: 500, description: '容量（毫升）：1-10000' })
  @IsInt({ message: '容量必须是整数' })
  @Min(1, { message: '容量必须大于 0' })
  @Max(10000, { message: '容量最多 10000 毫升' })
  volumeMl!: number;

  @ApiPropertyOptional({ example: 4.3, description: '酒精度（%）：0-100' })
  @IsOptional()
  @IsNumber({}, { message: '酒精度必须是数字' })
  @Min(0, { message: '酒精度不能小于 0' })
  @Max(100, { message: '酒精度不能大于 100' })
  alcoholPercent?: number;
}
