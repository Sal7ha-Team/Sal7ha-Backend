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
import { BookingsService } from './bookings.service';
import { BookingQueryDto } from './dto/booking-query.dto';
import {
  BatchStatusDto,
  BookingCreateDto,
  BookingStatusDto,
  BookingUpdateDto,
} from './dto/booking.dto';

@Roles(UserRole.business)
@Controller('bookings')
export class BookingsController {
  constructor(private bookings: BookingsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query() query: BookingQueryDto) {
    return this.bookings.list(user.businessId, query);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: BookingCreateDto) {
    return this.bookings.create(user.businessId, dto);
  }

  @Patch('batch/status')
  @Put('batch/status')
  batchStatus(@CurrentUser() user: JwtUser, @Body() dto: BatchStatusDto) {
    return this.bookings.batchStatus(user.businessId, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.bookings.get(user.businessId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: BookingUpdateDto,
  ) {
    return this.bookings.update(user.businessId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.bookings.remove(user.businessId, id);
  }

  @Patch(':id/status')
  @Put(':id/status')
  setStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: BookingStatusDto,
  ) {
    return this.bookings.setStatus(user.businessId, id, dto.status);
  }
}
