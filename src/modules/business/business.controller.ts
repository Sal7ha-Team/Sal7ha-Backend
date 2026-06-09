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
  Put,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { BusinessService } from './business.service';
import {
  BusinessServiceCreateDto,
  BusinessServiceDto,
  BusinessServiceQueryDto,
  BusinessServiceUpdateDto,
} from './dto/business-service.dto';
import { BusinessProfileDto } from './dto/business-profile.dto';

@Roles(UserRole.business)
@Controller('business')
export class BusinessController {
  constructor(private business: BusinessService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: JwtUser) {
    return this.business.getProfile(user.businessId);
  }

  @Get('setup-warnings')
  getSetupWarnings(@CurrentUser() user: JwtUser) {
    return this.business.getSetupWarnings(user.businessId);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: JwtUser, @Body() dto: BusinessProfileDto) {
    return this.business.updateProfile(user.businessId, dto);
  }

  @Get('services')
  getServices(
    @CurrentUser() user: JwtUser,
    @Query() query: BusinessServiceQueryDto,
  ) {
    return this.business.getServices(user.businessId, query);
  }

  @Post('services')
  createService(
    @CurrentUser() user: JwtUser,
    @Body() dto: BusinessServiceCreateDto,
  ) {
    return this.business.createService(user.businessId, dto);
  }

  @Put('services')
  replaceServices(
    @CurrentUser() user: JwtUser,
    @Body() items: BusinessServiceDto[],
  ) {
    return this.business.replaceServices(user.businessId, items);
  }

  @Patch('services/:businessServiceId')
  updateService(
    @CurrentUser() user: JwtUser,
    @Param('businessServiceId') id: string,
    @Body() dto: BusinessServiceUpdateDto,
  ) {
    return this.business.updateService(user.businessId, id, dto);
  }

  @Delete('services/:businessServiceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteService(
    @CurrentUser() user: JwtUser,
    @Param('businessServiceId') id: string,
  ) {
    return this.business.deleteService(user.businessId, id);
  }
}
