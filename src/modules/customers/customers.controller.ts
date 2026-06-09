import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CustomersService } from './customers.service';
import {
  CustomerCreateDto,
  CustomerQueryDto,
  CustomerUpdateDto,
} from './dto/customer.dto';

@Roles(UserRole.business)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query() query: CustomerQueryDto) {
    return this.customers.list(user.businessId, query);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CustomerCreateDto) {
    return this.customers.create(user.businessId, dto);
  }

  @Get(':customerId')
  get(@CurrentUser() user: JwtUser, @Param('customerId') id: string) {
    return this.customers.get(user.businessId, id);
  }

  @Patch(':customerId')
  update(
    @CurrentUser() user: JwtUser,
    @Param('customerId') id: string,
    @Body() dto: CustomerUpdateDto,
  ) {
    return this.customers.update(user.businessId, id, dto);
  }
}
