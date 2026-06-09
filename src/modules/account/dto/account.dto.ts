import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class AccountProfileUpdateDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsDateString() birthDate?: string | null;
  @IsOptional() @IsString() phoneNumber?: string;
  @IsOptional() @IsObject() address?: Record<string, unknown>;
}

export class SecuritySettingsUpdateDto {
  @IsObject()
  preferences!: Record<string, boolean>;
}

export class MfaUpdateDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional() @IsString() method?: 'sms' | 'authenticator';
  @IsOptional() @IsString() phone?: string | null;
}

export class NotificationPreferencesUpdateDto {
  @IsObject()
  preferences!: Record<string, boolean>;
}

export class OptionalEmailDto {
  @IsOptional() @IsEmail() email?: string;
}
