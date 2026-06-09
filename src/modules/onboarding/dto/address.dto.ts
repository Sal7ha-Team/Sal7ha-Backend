import { IsString } from 'class-validator';

export class AddressDto {
  @IsString() country!: string;
  @IsString() streetAddress!: string;
  @IsString() city!: string;
  @IsString() state!: string;
  @IsString() zipCode!: string;
}
