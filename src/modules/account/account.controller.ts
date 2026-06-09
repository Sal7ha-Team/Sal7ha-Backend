import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import { AccountService } from './account.service';
import {
  AccountProfileUpdateDto,
  MfaUpdateDto,
  NotificationPreferencesUpdateDto,
  SecuritySettingsUpdateDto,
} from './dto/account.dto';

@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('profile')
  profile(@CurrentUser() user: JwtUser) {
    return this.account.profile(user.sub);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: JwtUser,
    @Body() dto: AccountProfileUpdateDto,
  ) {
    return this.account.updateProfile(user.sub, dto);
  }

  @Get('security')
  security(@CurrentUser() user: JwtUser) {
    return this.account.security(user.sub);
  }

  @Patch('security')
  updateSecurity(
    @CurrentUser() user: JwtUser,
    @Body() dto: SecuritySettingsUpdateDto,
  ) {
    return this.account.updateSecurity(user.sub, dto);
  }

  @Put('mfa')
  updateMfa(@CurrentUser() user: JwtUser, @Body() dto: MfaUpdateDto) {
    return this.account.updateMfa(user.sub, dto);
  }

  @Get('notification-preferences')
  notificationPreferences(@CurrentUser() user: JwtUser) {
    return this.account.notificationPreferences(user.sub);
  }

  @Put('notification-preferences')
  updateNotificationPreferences(
    @CurrentUser() user: JwtUser,
    @Body() dto: NotificationPreferencesUpdateDto,
  ) {
    return this.account.updateNotificationPreferences(user.sub, dto);
  }
}
