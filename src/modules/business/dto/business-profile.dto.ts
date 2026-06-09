import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { BusinessType, EmployeeCount } from '@prisma/client';
import { AddressDto } from 'src/modules/onboarding/dto/address.dto';
import { WorkingHoursDto } from 'src/modules/onboarding/dto/build-business.dto';

export class BusinessProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phoneNumber?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsInt() commercialRegistrationNumber?: number;
  @IsOptional() @IsInt() commercialRegistraionNumber?: number;
  @IsOptional() @IsInt() taxIdentificationNumber?: number;

  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @IsOptional()
  @IsEnum(EmployeeCount)
  employeeCount?: EmployeeCount;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  location?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkingHoursDto)
  workingHours?: WorkingHoursDto;
}
