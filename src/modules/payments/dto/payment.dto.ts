import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PaymentQueryDto {
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() kind?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sortBy?: string;
  @IsOptional() @IsString() sortOrder?: 'asc' | 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 10;
}

export class PaymentSummaryQueryDto {
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
}

export class RefundPaymentDto {
  @IsOptional() @IsNumber() amount?: number | null;
  @IsOptional() @IsString() reason?: string | null;
}

export class BatchRefundPaymentsDto {
  @IsArray() @IsString({ each: true }) ids!: string[];
  @IsOptional() @IsString() reason?: string | null;
}

export class PaymentExportCreateDto {
  @IsString() format!: string;
  @IsOptional() @IsString() startDate?: string | null;
  @IsOptional() @IsString() endDate?: string | null;
  @IsArray() @IsString({ each: true }) categories!: string[];
  @IsOptional() @IsNumber() minPrice?: number | null;
  @IsOptional() @IsNumber() maxPrice?: number | null;
  @IsOptional() @IsArray() @IsString({ each: true }) paymentIds?: string[];
}
