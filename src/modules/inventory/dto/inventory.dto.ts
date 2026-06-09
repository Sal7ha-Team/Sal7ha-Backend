import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class InventoryItemQueryDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() viscosity?: string;
  @IsOptional() @IsString() volume?: string;
  @IsOptional() @IsString() application?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 10;
}

export class InventoryItemDto {
  @IsString() category!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() specification?: string;
  @IsOptional() @IsString() viscosity?: string;
  @IsOptional() @IsString() capacity?: string;
  @IsOptional() @IsString() volume?: string;
  @IsOptional() @IsString() apiSpec?: string;
  @IsOptional() @IsString() application?: string;
  @IsOptional() @IsString() details?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) usedInServices?: string[];
  @IsOptional() @IsString() imageUrl?: string;
  @IsNumber() price!: number;
  @IsOptional() @IsNumber() purchasePrice?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() deliveryTime?: string;
  @IsOptional() @IsInt() @Min(0) quantity?: number;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
  @IsOptional() @IsString() status?: string;
}

export class InventoryItemUpdateDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() specification?: string;
  @IsOptional() @IsString() viscosity?: string;
  @IsOptional() @IsString() capacity?: string;
  @IsOptional() @IsString() volume?: string;
  @IsOptional() @IsString() apiSpec?: string;
  @IsOptional() @IsString() application?: string;
  @IsOptional() @IsString() details?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) usedInServices?: string[];
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsNumber() purchasePrice?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() deliveryTime?: string;
  @IsOptional() @IsInt() @Min(0) quantity?: number;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
  @IsOptional() @IsString() status?: string;
}

export class SellInventoryItemDto {
  @IsInt() @Min(1) quantity = 1;
  @IsOptional() @IsString() customerId?: string | null;
  @IsString() paymentMethod!: string;
  @IsOptional() @IsNumber() unitPrice?: number | null;
}

export class InventoryTransactionQueryDto {
  @IsOptional() @IsString() inventoryItemId?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 10;
}
