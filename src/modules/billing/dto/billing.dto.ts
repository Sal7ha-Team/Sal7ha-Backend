import { IsEmail, IsOptional, IsString } from 'class-validator';

export class BankAccountCreateDto {
  @IsString() bankName!: string;
  @IsString() accountHolder!: string;
  @IsString() accountNumber!: string;
  @IsString() iban!: string;
  @IsString() swift!: string;
  @IsString() branch!: string;
  @IsEmail() billingEmail!: string;
}

export class BankAccountUpdateDto {
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() accountHolder?: string;
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @IsString() iban?: string;
  @IsOptional() @IsString() swift?: string;
  @IsOptional() @IsString() branch?: string;
  @IsOptional() @IsEmail() billingEmail?: string;
}
