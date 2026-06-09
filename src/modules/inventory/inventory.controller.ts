import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  InventoryItemDto,
  InventoryItemQueryDto,
  InventoryItemUpdateDto,
  InventoryTransactionQueryDto,
  SellInventoryItemDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@Roles(UserRole.business)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('catalog')
  catalog() {
    return this.inventory.catalog();
  }

  @Get('items')
  list(@CurrentUser() user: JwtUser, @Query() query: InventoryItemQueryDto) {
    return this.inventory.list(user.businessId, query);
  }

  @Post('items')
  create(@CurrentUser() user: JwtUser, @Body() dto: InventoryItemDto) {
    return this.inventory.create(user.businessId, dto);
  }

  @Get('items/:inventoryItemId')
  get(@CurrentUser() user: JwtUser, @Param('inventoryItemId') id: string) {
    return this.inventory.get(user.businessId, id);
  }

  @Patch('items/:inventoryItemId')
  update(
    @CurrentUser() user: JwtUser,
    @Param('inventoryItemId') id: string,
    @Body() dto: InventoryItemUpdateDto,
  ) {
    return this.inventory.update(user.businessId, id, dto);
  }

  @Delete('items/:inventoryItemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtUser, @Param('inventoryItemId') id: string) {
    return this.inventory.remove(user.businessId, id);
  }

  @Post('items/:inventoryItemId/sell')
  sell(
    @CurrentUser() user: JwtUser,
    @Param('inventoryItemId') id: string,
    @Body() dto: SellInventoryItemDto,
  ) {
    return this.inventory.sell(user.businessId, user.sub, id, dto);
  }

  @Get('transactions')
  transactions(
    @CurrentUser() user: JwtUser,
    @Query() query: InventoryTransactionQueryDto,
  ) {
    return this.inventory.transactions(user.businessId, query);
  }
}
