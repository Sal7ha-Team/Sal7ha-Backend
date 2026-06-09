import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum TwoFactorMethodInput {
  sms = 'sms',
  authenticator = 'authenticator',
}

export class TwoFactorAuthDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsEnum(TwoFactorMethodInput)
  method!: TwoFactorMethodInput;

  @IsOptional()
  @IsString()
  phone?: string;
}
