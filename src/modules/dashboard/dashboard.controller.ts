import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Put,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardWidgetPreferencesUpdateDto } from './dto/dashboard-widgets.dto';

@Roles(UserRole.business)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() user: JwtUser) {
    return this.dashboard.summary(user.businessId);
  }

  @Get('bookings/month')
  month(
    @CurrentUser() user: JwtUser,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.dashboard.bookingsByMonth(user.businessId, year, month);
  }

  @Get('widgets')
  widgets(@CurrentUser() user: JwtUser) {
    return this.dashboard.widgets(user.sub);
  }

  @Put('widgets')
  updateWidgets(
    @CurrentUser() user: JwtUser,
    @Body() dto: DashboardWidgetPreferencesUpdateDto,
  ) {
    return this.dashboard.updateWidgets(user.sub, dto);
  }
}
