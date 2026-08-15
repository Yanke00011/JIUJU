import { Module } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { OperationLogService } from './operation-logs.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminRoomsController } from './admin-rooms.controller';
import { AdminRoomsService } from './admin-rooms.service';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminLogsController } from './admin-logs.controller';
import { AdminLogsService } from './admin-logs.service';
import { AdminDrinksController } from './admin-drinks.controller';
import { AdminDrinksService } from './admin-drinks.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';

@Module({
  controllers: [
    AdminUsersController,
    AdminRoomsController,
    AdminProductsController,
    AdminLogsController,
    AdminDrinksController,
    AdminDashboardController,
  ],
  providers: [
    AdminGuard,
    SuperAdminGuard,
    OperationLogService,
    AdminUsersService,
    AdminRoomsService,
    AdminProductsService,
    AdminLogsService,
    AdminDrinksService,
    AdminDashboardService,
  ],
  exports: [OperationLogService],
})
export class AdminModule {}
