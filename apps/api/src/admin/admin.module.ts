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
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';

@Module({
  controllers: [
    AdminUsersController,
    AdminRoomsController,
    AdminProductsController,
    AdminLogsController,
    AdminDrinksController,
    AdminDashboardController,
    AdminAnalyticsController,
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
    AdminAnalyticsService,
  ],
  exports: [OperationLogService],
})
export class AdminModule {}
