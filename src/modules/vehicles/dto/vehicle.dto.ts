import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class VehicleQueryDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 10;
}

export class VehicleCreateDto {
  @IsString() customerId!: string;
  @IsString() make!: string;
  @IsString() model!: string;
  @IsString() year!: string;
  @IsOptional() @IsString() plate?: string;
  @IsOptional() @IsString() vin?: string;
}

export class VehicleUpdateDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() make?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() year?: string;
  @IsOptional() @IsString() plate?: string;
  @IsOptional() @IsString() vin?: string;
}
