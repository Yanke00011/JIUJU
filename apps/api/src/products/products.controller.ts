import { Body, Controller, Get, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { toProductDto } from './product.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';
const PRODUCT_RESPONSE_EXAMPLE = {
  id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
  barcode: '6901234567890',
  name: 'XX啤酒',
  brand: 'XX',
  category: 'BEER',
  volumeMl: 500,
  alcoholPercent: 4.3,
};

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('barcode/:barcode')
  @ApiOperation({ summary: '按条形码查询酒品', description: '使用 EAN-13 等数字条形码查询商品。' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '查询成功',
    schema: {
      example: { success: true, data: { product: PRODUCT_RESPONSE_EXAMPLE } },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '酒品不存在',
    schema: {
      example: {
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: '酒品不存在' },
      },
    },
  })
  async findByBarcode(@Param('barcode') barcode: string) {
    const product = await this.productsService.findByBarcode(barcode);
    return { product: toProductDto(product) };
  }

  @Get(':id')
  @ApiOperation({
    summary: '按 ID 查询酒品',
    description: '酒品为全局商品数据，登录用户即可查询。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '查询成功',
    schema: {
      example: { success: true, data: { product: PRODUCT_RESPONSE_EXAMPLE } },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '酒品不存在',
    schema: {
      example: {
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: '酒品不存在' },
      },
    },
  })
  async findById(@Param('id') id: string) {
    const product = await this.productsService.findById(id);
    return { product: toProductDto(product) };
  }

  @Post()
  @ApiOperation({ summary: '创建酒品', description: '创建新商品，barcode 唯一。' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '创建成功',
    schema: {
      example: { success: true, data: { product: PRODUCT_RESPONSE_EXAMPLE } },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '条形码已存在',
    schema: {
      example: {
        success: false,
        error: { code: 'PRODUCT_ALREADY_EXISTS', message: '该条形码对应的酒品已存在' },
      },
    },
  })
  async create(@Body() dto: CreateProductDto) {
    const product = await this.productsService.create(dto);
    return { product: toProductDto(product) };
  }

  @Patch(':id')
  @ApiOperation({
    summary: '修改酒品',
    description: '可修改 name/brand/category/volumeMl/alcoholPercent；不允许修改 id 与 barcode。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '修改成功',
    schema: {
      example: { success: true, data: { product: PRODUCT_RESPONSE_EXAMPLE } },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '酒品不存在',
    schema: {
      example: {
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: '酒品不存在' },
      },
    },
  })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    const product = await this.productsService.update(id, dto);
    return { product: toProductDto(product) };
  }
}
