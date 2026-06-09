import { IsIn, IsOptional, IsString } from 'class-validator';

export class ApplicationStatsQueryDto {
  @IsIn(['week', 'month', 'year'])
  period!: 'week' | 'month' | 'year';

  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
}
