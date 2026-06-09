import { Type } from 'class-transformer';
import { IsEmail, IsString, ValidateNested } from 'class-validator';
import { AddressDto } from './address.dto';

export class OwnerInformationDto {
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsEmail() email!: string;

  @ValidateNested()
  @Type(() => AddressDto)
  location!: AddressDto;
}
