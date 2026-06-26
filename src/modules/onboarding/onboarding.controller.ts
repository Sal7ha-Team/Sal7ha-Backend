import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { OnboardingService } from './onboarding.service';
import { OwnerInformationDto } from './dto/owner-information.dto';
import { BusinessInformationDto } from './dto/business-information.dto';
import { BuildBusinessDto } from './dto/build-business.dto';
import { BankDetailsDto } from './dto/bank-details.dto';
import { TwoFactorAuthDto } from './dto/two-factor.dto';

@Roles(UserRole.business)
@Controller('onboarding')
export class OnboardingController {
  constructor(private onboarding: OnboardingService) {}

  @Get('progress')
  progress(@CurrentUser() user: JwtUser) {
    return this.onboarding.getProgress(user.businessId);
  }

  @Put('owner-information')
  ownerInformation(
    @CurrentUser() user: JwtUser,
    @Body() dto: OwnerInformationDto,
  ) {
    return this.onboarding.saveOwnerInformation(user.sub, user.businessId, dto);
  }

  @Post('owner-information')
  createOwnerInformation(
    @CurrentUser() user: JwtUser,
    @Body() dto: OwnerInformationDto,
  ) {
    return this.ownerInformation(user, dto);
  }

  @Put('business-information')
  businessInformation(
    @CurrentUser() user: JwtUser,
    @Body() dto: BusinessInformationDto,
  ) {
    return this.onboarding.saveBusinessInformation(user.businessId, dto);
  }

  @Post('business-information')
  createBusinessInformation(
    @CurrentUser() user: JwtUser,
    @Body() dto: BusinessInformationDto,
  ) {
    return this.businessInformation(user, dto);
  }

  @Post('build-business')
  buildBusiness(@CurrentUser() user: JwtUser, @Body() dto: BuildBusinessDto) {
    return this.onboarding.saveBuildBusiness(user.businessId, dto);
  }

  @Put('bank-details')
  bankDetails(@CurrentUser() user: JwtUser, @Body() dto: BankDetailsDto) {
    return this.onboarding.saveBankDetails(user.businessId, dto);
  }

  @Post('bank-details')
  createBankDetails(@CurrentUser() user: JwtUser, @Body() dto: BankDetailsDto) {
    return this.bankDetails(user, dto);
  }

  @Put('two-factor-auth')
  twoFactor(@CurrentUser() user: JwtUser, @Body() dto: TwoFactorAuthDto) {
    return this.onboarding.saveTwoFactor(user.sub, user.businessId, dto);
  }

  @Post('two-factor-auth')
  createTwoFactor(@CurrentUser() user: JwtUser, @Body() dto: TwoFactorAuthDto) {
    return this.twoFactor(user, dto);
  }

  @Post('submit')
  submit(@CurrentUser() user: JwtUser) {
    return this.onboarding.submit(user.businessId);
  }
}
