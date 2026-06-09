import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiBookingStatus } from './booking-query.dto';

export class ServiceDetailDto {
  @IsString() label!: string;
  @IsString() value!: string;
}

export class BookingCreateDto {
  @IsString() serviceId!: string;
  @IsString() customerId!: string;
  @IsOptional() @IsString() vehicleId?: string;
  @IsOptional() @IsString() carMake?: string;
  @IsOptional() @IsString() carModel?: string;
  @IsOptional() @IsString() carYear?: string;
  @IsString() startDate!: string;
  @IsString() endDate!: string;

  @IsOptional()
  @IsEnum(ApiBookingStatus)
  status?: ApiBookingStatus;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceDetailDto)
  serviceDetails?: ServiceDetailDto[];
}

export class BookingUpdateDto {
  @IsOptional() @IsString() serviceId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() vehicleId?: string;

  @IsOptional()
  @IsEnum(ApiBookingStatus)
  status?: ApiBookingStatus;

  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceDetailDto)
  serviceDetails?: ServiceDetailDto[];

  @IsOptional() @IsString() notes?: string;
}

export class BookingStatusDto {
  @IsEnum(ApiBookingStatus)
  status!: ApiBookingStatus;
}

export class BatchStatusDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsEnum(ApiBookingStatus)
  status!: ApiBookingStatus;
}
