import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum ApiBookingStatus {
  Pending = 'Pending',
  Accepted = 'Accepted',
  InProgress = 'In-Progress',
  InProgressLegacy = 'In_Progress',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

export enum BookingSortBy {
  serviceName = 'serviceName',
  name = 'name',
  carMake = 'carMake',
  startDate = 'startDate',
  endDate = 'endDate',
  status = 'status',
  price = 'price',
}

export enum SortOrder {
  asc = 'asc',
  desc = 'desc',
}

export class BookingQueryDto {
  @IsOptional()
  @IsEnum(ApiBookingStatus)
  status?: ApiBookingStatus;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(BookingSortBy)
  sortBy?: BookingSortBy;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.asc;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}
