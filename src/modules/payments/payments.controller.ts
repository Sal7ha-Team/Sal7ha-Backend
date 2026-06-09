import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  BatchRefundPaymentsDto,
  PaymentExportCreateDto,
  PaymentQueryDto,
  PaymentSummaryQueryDto,
  RefundPaymentDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Roles(UserRole.business)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query() query: PaymentQueryDto) {
    return this.payments.list(user.businessId, query);
  }

  @Get('summary')
  summary(
    @CurrentUser() user: JwtUser,
    @Query() query: PaymentSummaryQueryDto,
  ) {
    return this.payments.summary(user.businessId, query);
  }

  @Post('batch/refund')
  batchRefund(
    @CurrentUser() user: JwtUser,
    @Body() dto: BatchRefundPaymentsDto,
  ) {
    return this.payments.batchRefund(user.businessId, user.sub, dto);
  }

  @Post('export-jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  createExportJob(
    @CurrentUser() user: JwtUser,
    @Body() dto: PaymentExportCreateDto,
  ) {
    return this.payments.createExportJob(user.businessId, user.sub, dto);
  }

  @Get('export-jobs/:jobId')
  getExportJob(@CurrentUser() user: JwtUser, @Param('jobId') id: string) {
    return this.payments.getExportJob(user.businessId, id);
  }

  @Get('export-jobs/:jobId/download')
  async downloadExport(
    @CurrentUser() user: JwtUser,
    @Param('jobId') id: string,
    @Res() response: Response,
  ) {
    const file = await this.payments.downloadExport(user.businessId, id);
    response.setHeader('content-type', file.contentType);
    response.setHeader(
      'content-disposition',
      `attachment; filename="${file.filename}"`,
    );
    response.send(file.content);
  }

  @Get(':paymentId')
  get(@CurrentUser() user: JwtUser, @Param('paymentId') id: string) {
    return this.payments.get(user.businessId, id);
  }

  @Post(':paymentId/refund')
  refund(
    @CurrentUser() user: JwtUser,
    @Param('paymentId') id: string,
    @Body() dto: RefundPaymentDto,
  ) {
    return this.payments.refund(user.businessId, user.sub, id, dto);
  }
}
