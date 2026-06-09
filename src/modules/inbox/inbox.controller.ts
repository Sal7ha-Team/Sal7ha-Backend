import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import { InboxQueryDto } from './dto/inbox.dto';
import { InboxService } from './inbox.service';

@Controller('inbox')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get('messages')
  list(@CurrentUser() user: JwtUser, @Query() query: InboxQueryDto) {
    return this.inbox.list(user.sub, query);
  }

  @Post('messages/:messageId/read')
  markRead(@CurrentUser() user: JwtUser, @Param('messageId') id: string) {
    return this.inbox.markRead(user.sub, id);
  }
}
