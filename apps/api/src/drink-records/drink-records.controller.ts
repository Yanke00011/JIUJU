import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicUser } from '../common/utils/public-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateDrinkRecordDto, UpdateDrinkRecordDto } from './dto/drink-record.dto';
import { DrinkRecordsService } from './drink-records.service';

const DRINK_EXAMPLE = {
  id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
  roomId: 'c7d8e9f0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
  productId: 'd8e9f0a1-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
  userId: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
  barcode: '6901234567890',
  volumeMlSnapshot: 500,
  alcoholPercentSnapshot: 4.3,
  quantity: 1,
  createdAt: '2026-08-15T05:00:00.000Z',
  updatedAt: '2026-08-15T05:00:00.000Z',
  user: { id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f', nickname: '张三', avatar: null },
  product: { id: 'd8e9f0a1-4c3e-4a5b-9f8e-1a2b3c4d5e6f', name: 'XX啤酒', brand: 'XX' },
};

@ApiTags('drink-records')
@ApiBearerAuth()
@Controller('rooms/:id/drinks')
export class DrinkRecordsController {
  constructor(private readonly drinkRecordsService: DrinkRecordsService) {}

  @Post()
  @ApiOperation({
    summary: '创建饮酒记录',
    description: '登记一瓶/一次饮酒。普通成员只能登记自己，OWNER 可登记房间成员。',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '创建成功',
    schema: { example: { success: true, data: { record: DRINK_EXAMPLE } } },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '房间不存在或非成员 / 酒品不存在',
    schema: {
      example: { success: false, error: { code: 'PRODUCT_NOT_FOUND', message: '酒品不存在' } },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '房间已结束',
    schema: {
      example: { success: false, error: { code: 'ROOM_ENDED', message: '房间已结束，无法操作' } },
    },
  })
  async create(
    @CurrentUser() user: PublicUser,
    @Param('id') roomId: string,
    @Body() dto: CreateDrinkRecordDto,
  ) {
    const record = await this.drinkRecordsService.create(user.id, roomId, dto);
    return { record };
  }

  @Get()
  @ApiOperation({
    summary: '房间饮酒记录列表',
    description: '仅房间成员可查看，默认排除已软删除记录。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: { example: { success: true, data: { items: [DRINK_EXAMPLE] } } },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '房间不存在或非成员',
    schema: {
      example: { success: false, error: { code: 'ROOM_NOT_FOUND', message: '房间不存在' } },
    },
  })
  async list(@CurrentUser() user: PublicUser, @Param('id') roomId: string) {
    const items = await this.drinkRecordsService.list(user.id, roomId);
    return { items };
  }

  @Get(':drinkId')
  @ApiOperation({ summary: '饮酒记录详情', description: '仅房间成员可查看。' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: { example: { success: true, data: { record: DRINK_EXAMPLE } } },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '房间不存在或非成员 / 记录不存在',
    schema: {
      example: {
        success: false,
        error: { code: 'DRINK_RECORD_NOT_FOUND', message: '饮酒记录不存在' },
      },
    },
  })
  async getOne(
    @CurrentUser() user: PublicUser,
    @Param('id') roomId: string,
    @Param('drinkId') drinkId: string,
  ) {
    const record = await this.drinkRecordsService.getOne(user.id, roomId, drinkId);
    return { record };
  }

  @Patch(':drinkId')
  @ApiOperation({
    summary: '修改饮酒记录',
    description: '仅允许修改 quantity 与 userId；不允许修改 roomId/productId。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '修改成功',
    schema: { example: { success: true, data: { record: DRINK_EXAMPLE } } },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '房间不存在或非成员 / 记录不存在',
    schema: {
      example: {
        success: false,
        error: { code: 'DRINK_RECORD_NOT_FOUND', message: '饮酒记录不存在' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: '普通成员只能修改自己的记录',
    schema: {
      example: {
        success: false,
        error: { code: 'DRINK_NOT_OWNER', message: '只能修改自己的饮酒记录' },
      },
    },
  })
  async update(
    @CurrentUser() user: PublicUser,
    @Param('id') roomId: string,
    @Param('drinkId') drinkId: string,
    @Body() dto: UpdateDrinkRecordDto,
  ) {
    const record = await this.drinkRecordsService.update(user.id, roomId, drinkId, dto);
    return { record };
  }

  @Delete(':drinkId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '软删除饮酒记录',
    description: '设置 deletedAt 与 deletedBy，不删除数据库记录。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '删除成功',
    schema: { example: { success: true, data: {} } },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '房间不存在或非成员 / 记录不存在',
    schema: {
      example: {
        success: false,
        error: { code: 'DRINK_RECORD_NOT_FOUND', message: '饮酒记录不存在' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: '普通成员只能删除自己的记录',
    schema: {
      example: {
        success: false,
        error: { code: 'DRINK_NOT_OWNER', message: '只能删除自己的饮酒记录' },
      },
    },
  })
  async softDelete(
    @CurrentUser() user: PublicUser,
    @Param('id') roomId: string,
    @Param('drinkId') drinkId: string,
  ) {
    await this.drinkRecordsService.softDelete(user.id, roomId, drinkId);
    return {};
  }
}
