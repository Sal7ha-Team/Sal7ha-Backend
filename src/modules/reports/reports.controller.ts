import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ApplicationStatsQueryDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';

@Roles(UserRole.business)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('application-stats')
  applicationStats(
    @CurrentUser() user: JwtUser,
    @Query() query: ApplicationStatsQueryDto,
  ) {
    return this.reports.applicationStats(user.businessId, query);
  }
}
