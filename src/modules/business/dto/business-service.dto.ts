import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class BusinessServiceDto {
  @IsOptional() @IsString() serviceId?: string;

  @IsOptional() @IsNumber() priceMin?: number;
  @IsOptional() @IsNumber() priceMax?: number;

  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class BusinessServiceQueryDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() status?: string;
}

export class BusinessServiceCreateDto {
  @IsOptional() @IsString() serviceId?: string | null;
  @IsString() category!: string;
  @IsString() name!: string;
  @IsNumber() price!: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() status?: string;
}

export class BusinessServiceUpdateDto {
  @IsOptional() @IsString() serviceId?: string | null;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() status?: string;
}
