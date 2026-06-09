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
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { BillingService } from './billing.service';
import { BankAccountCreateDto, BankAccountUpdateDto } from './dto/billing.dto';

@Roles(UserRole.business)
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('banks')
  banks() {
    return this.billing.banks();
  }

  @Get('accounts')
  list(@CurrentUser() user: JwtUser) {
    return this.billing.list(user.businessId);
  }

  @Post('accounts')
  create(@CurrentUser() user: JwtUser, @Body() dto: BankAccountCreateDto) {
    return this.billing.create(user.businessId, dto);
  }

  @Get('accounts/:billingAccountId')
  get(@CurrentUser() user: JwtUser, @Param('billingAccountId') id: string) {
    return this.billing.get(user.businessId, id);
  }

  @Patch('accounts/:billingAccountId')
  update(
    @CurrentUser() user: JwtUser,
    @Param('billingAccountId') id: string,
    @Body() dto: BankAccountUpdateDto,
  ) {
    return this.billing.update(user.businessId, id, dto);
  }

  @Delete('accounts/:billingAccountId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtUser, @Param('billingAccountId') id: string) {
    return this.billing.remove(user.businessId, id);
  }

  @Post('accounts/:billingAccountId/submit')
  @HttpCode(HttpStatus.ACCEPTED)
  submit(@CurrentUser() user: JwtUser, @Param('billingAccountId') id: string) {
    return this.billing.submit(user.businessId, id);
  }
}
