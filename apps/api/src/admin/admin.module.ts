import { Module } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { OperationLogService } from './operation-logs.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminRoomsController } from './admin-rooms.controller';
import { AdminRoomsService } from './admin-rooms.service';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminLogsController } from './admin-logs.controller';
import { AdminLogsService } from './admin-logs.service';

@Module({
  controllers: [
    AdminUsersController,
    AdminRoomsController,
    AdminProductsController,
    AdminLogsController,
  ],
  providers: [
    AdminGuard,
    OperationLogService,
    AdminUsersService,
    AdminRoomsService,
    AdminProductsService,
    AdminLogsService,
  ],
  exports: [OperationLogService],
})
export class AdminModule {}
