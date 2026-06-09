import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class BankDetailsDto {
  @IsString() bankName!: string;
  @IsString() accountHolder!: string;
  @IsOptional() @IsString() accountNumber?: string;

  @Matches(/^[A-Z]{2}\d{2}[A-Za-z0-9]{4,30}$/)
  iban!: string;

  @IsOptional() @IsString() swift?: string;
  @IsOptional() @IsString() branch?: string;
  @IsOptional() @IsEmail() billingEmail?: string;
}
