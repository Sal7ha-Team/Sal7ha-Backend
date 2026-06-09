import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SupportTicketCreateDto {
  @IsString() subject!: string;
  @IsString() message!: string;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @IsString() priority?: 'low' | 'normal' | 'high';
}

export class FeedbackCreateDto {
  @IsString() message!: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number | null;
  @IsOptional() @IsString() page?: string | null;
}
