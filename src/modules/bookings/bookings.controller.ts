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
import { MobileService } from '../mobile/mobile.service';
import { BookingsService } from './bookings.service';
import { BookingQueryDto } from './dto/booking-query.dto';
import {
  BatchStatusDto,
  BookingStatusDto,
  BookingUpdateDto,
} from './dto/booking.dto';

@Roles(UserRole.business, UserRole.client)
@Controller('bookings')
export class BookingsController {
  constructor(
    private bookings: BookingsService,
    private mobile: MobileService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query() query: BookingQueryDto) {
    if (user.role === UserRole.client) {
      return this.mobile.listBookings(user.sub, query);
    }
    return this.bookings.list(user.businessId, query);
  }

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  quote(@Body() dto: any) {
    return this.mobile.quoteBooking(dto);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: any) {
    if (user.role === UserRole.client) {
      return this.mobile.createBooking(user.sub, dto);
    }
    return this.bookings.create(user.businessId, dto);
  }

  @Roles(UserRole.business)
  @Patch('batch/status')
  batchStatus(@CurrentUser() user: JwtUser, @Body() dto: BatchStatusDto) {
    return this.bookings.batchStatus(user.businessId, dto);
  }

  @Roles(UserRole.business)
  @Put('batch/status')
  putBatchStatus(@CurrentUser() user: JwtUser, @Body() dto: BatchStatusDto) {
    return this.batchStatus(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    if (user.role === UserRole.client) {
      return this.mobile.getBooking(user.sub, id);
    }
    return this.bookings.get(user.businessId, id);
  }

  @Roles(UserRole.business)
  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: BookingUpdateDto,
  ) {
    return this.bookings.update(user.businessId, id, dto);
  }

  @Roles(UserRole.business)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.bookings.remove(user.businessId, id);
  }

  @Roles(UserRole.business)
  @Patch(':id/status')
  setStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: BookingStatusDto,
  ) {
    return this.bookings.setStatus(user.businessId, id, dto.status);
  }

  @Roles(UserRole.business)
  @Put(':id/status')
  putStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: BookingStatusDto,
  ) {
    return this.setStatus(user, id, dto);
  }

  @Roles(UserRole.client)
  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.mobile.cancelBooking(user.sub, id, dto);
  }
}
