import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class BusinessOwnerDto {
  @IsEmail() email!: string;
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsString() phoneNumber!: string;
  @IsString() streetAddress!: string;
  @IsString() country!: string;
  @IsString() city!: string;
}

export class BusinessSignUpDto {
  @IsEmail() email!: string;

  @IsString()
  @MinLength(12)
  password!: string;

  @IsString() name!: string;
  @IsString() phoneNumber!: string;
  @IsString() country!: string;
  @IsString() city!: string;

  @IsOptional() @IsInt() commercialRegistrationNumber?: number;
  @IsOptional() @IsInt() commercialRegistraionNumber?: number;
  @IsInt() taxIdentificationNumber!: number;

  @ValidateNested()
  @Type(() => BusinessOwnerDto)
  businessOwner!: BusinessOwnerDto;
}
