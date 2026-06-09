import { IsArray, IsString } from 'class-validator';

export class DashboardWidgetPreferencesUpdateDto {
  @IsArray()
  @IsString({ each: true })
  activeWidgetIds!: string[];
}
