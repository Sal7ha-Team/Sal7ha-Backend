import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { FeedbackCreateDto, SupportTicketCreateDto } from './dto/support.dto';
import { SupportService } from './support.service';

@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Public()
  @Get('help-center')
  helpCenter(@Query('locale') locale = 'en') {
    return this.support.helpCenter(locale);
  }

  @Post('tickets')
  createTicket(
    @CurrentUser() user: JwtUser,
    @Body() dto: SupportTicketCreateDto,
  ) {
    return this.support.createTicket(user, dto);
  }
}

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly support: SupportService) {}

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: FeedbackCreateDto) {
    return this.support.createFeedback(user, dto);
  }
}
