import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class LocationSearchDto {
  @IsString() query!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) limit = 8;
}

export class NearbyDto {
  @Type(() => Number) @IsNumber() lat!: number;
  @Type(() => Number) @IsNumber() lng!: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10000)
  radiusMeters = 1500;
}
