import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class WorkingHoursDto {
  @IsString() open!: string;
  @IsString() close!: string;
}

export class BuildBusinessDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  services!: string[];

  @ValidateNested()
  @Type(() => WorkingHoursDto)
  workingHours!: WorkingHoursDto;

  @IsOptional()
  @IsObject()
  categoryInventory?: Record<string, Record<string, string[]>>;

  @IsOptional()
  @IsObject()
  servicePrices?: Record<string, { min: string; max: string }>;
}
