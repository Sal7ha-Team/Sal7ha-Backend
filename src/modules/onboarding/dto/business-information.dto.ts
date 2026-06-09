import { Type } from 'class-transformer';
import { IsEnum, IsString, ValidateNested } from 'class-validator';
import { AddressDto } from './address.dto';

export enum BusinessTypeInput {
  general_repair = 'general-repair',
  specialized = 'specialized',
  body_paint = 'body-paint',
  quick_service = 'quick-service',
}

export enum EmployeeCountInput {
  small = 'small',
  medium = 'medium',
  large = 'large',
}

export class BusinessInformationDto {
  @IsString() businessName!: string;

  @IsEnum(BusinessTypeInput)
  businessType!: BusinessTypeInput;

  @IsEnum(EmployeeCountInput)
  employeeCount!: EmployeeCountInput;

  @ValidateNested()
  @Type(() => AddressDto)
  location!: AddressDto;
}
