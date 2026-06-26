import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export class RegisterNotificationDeviceDto {
  @IsString()
  token!: string;

  @IsIn(['android', 'ios', 'web'])
  platform!: 'android' | 'ios' | 'web';

  @IsOptional()
  @IsIn(['mobile', 'website'])
  client?: 'mobile' | 'website';

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class UnregisterNotificationDeviceDto {
  @ValidateIf((dto: UnregisterNotificationDeviceDto) => !dto.deviceId)
  @IsString()
  token?: string;

  @ValidateIf((dto: UnregisterNotificationDeviceDto) => !dto.token)
  @IsString()
  deviceId?: string;
}
