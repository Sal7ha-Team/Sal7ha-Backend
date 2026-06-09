import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryItem,
  InventoryTransaction,
  Payment,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { cacheKeys, CACHE_TTL_SECONDS } from 'src/common/cache/cache-keys';
import { pagination, paginationMeta } from 'src/common/utils/pagination.util';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  InventoryItemDto,
  InventoryItemQueryDto,
  InventoryItemUpdateDto,
  InventoryTransactionQueryDto,
  SellInventoryItemDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly prisma: PrismaService,
  ) {}

  private requireBusiness(businessId: number | null | undefined) {
    if (!businessId) throw new BadRequestException('No business context');
    return businessId;
  }

  async catalog() {
    return this.cache.remember(
      cacheKeys.inventoryCatalog(),
      CACHE_TTL_SECONDS.inventoryCatalog,
      async () => {
        const categories = await this.prisma.serviceCategory.findMany({
          include: { configOptions: true, services: true },
          orderBy: { name: 'asc' },
        });
        return {
          categories: categories.map((category) => ({
            name: category.name,
            icon: '',
            itemNames: category.services.map((service) => service.name),
            companies: [],
            specifications: this.options(
              category.configOptions,
              'specification',
            ),
            capacities: this.options(category.configOptions, 'capacity'),
            details: this.options(category.configOptions, 'details'),
            usedInServices: category.services.map((service) => service.name),
          })),
        };
      },
    );
  }

  async list(
    businessId: number | null | undefined,
    query: InventoryItemQueryDto,
  ) {
    const bid = this.requireBusiness(businessId);
    const page = pagination(query);
    const where: Prisma.InventoryItemWhereInput = {
      businessId: bid,
      category: query.category,
      company: query.brand,
      type: query.type,
      specification: query.viscosity,
      capacity: query.volume,
      application: query.application,
    };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { company: { contains: query.search, mode: 'insensitive' } },
        { details: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inventoryItem.count({ where }),
      this.prisma.inventoryItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
    ]);
    return {
      data: rows.map((row) => this.serializeItem(row)),
      pagination: paginationMeta(total, page.page, page.limit),
    };
  }

  async create(businessId: number | null | undefined, dto: InventoryItemDto) {
    const bid = this.requireBusiness(businessId);
    const row = await this.prisma.inventoryItem.create({
      data: this.itemData(bid, dto) as Prisma.InventoryItemUncheckedCreateInput,
    });
    await this.invalidate(bid);
    return this.serializeItem(row);
  }

  async get(businessId: number | null | undefined, id: string) {
    const row = await this.prisma.inventoryItem.findFirst({
      where: { id, businessId: this.requireBusiness(businessId) },
    });
    if (!row) throw new NotFoundException('Inventory item not found');
    return this.serializeItem(row);
  }

  async update(
    businessId: number | null | undefined,
    id: string,
    dto: InventoryItemUpdateDto,
  ) {
    const bid = this.requireBusiness(businessId);
    await this.get(bid, id);
    const row = await this.prisma.inventoryItem.update({
      where: { id },
      data: this.itemData(
        undefined,
        dto,
      ) as Prisma.InventoryItemUncheckedUpdateInput,
    });
    await this.invalidate(bid);
    return this.serializeItem(row);
  }

  async remove(businessId: number | null | undefined, id: string) {
    const bid = this.requireBusiness(businessId);
    await this.get(bid, id);
    await this.prisma.inventoryItem.delete({ where: { id } });
    await this.invalidate(bid);
  }

  async sell(
    businessId: number | null | undefined,
    userId: number,
    id: string,
    dto: SellInventoryItemDto,
  ) {
    const bid = this.requireBusiness(businessId);
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, businessId: bid },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    if (item.quantity < dto.quantity) {
      throw new BadRequestException('Not enough stock available');
    }

    const unitPrice = dto.unitPrice ?? Number(item.price);
    const paymentId = `PAY-${randomUUID().slice(0, 8).toUpperCase()}`;
    const [updatedItem, transaction, payment] = await this.prisma.$transaction([
      this.prisma.inventoryItem.update({
        where: { id },
        data: { quantity: { decrement: dto.quantity } },
      }),
      this.prisma.inventoryTransaction.create({
        data: {
          businessId: bid,
          inventoryItemId: id,
          type: 'sale',
          quantity: dto.quantity,
          unitPrice,
          paymentId,
          createdBy: userId,
        },
      }),
      this.prisma.payment.create({
        data: {
          id: paymentId,
          businessId: bid,
          customerId: dto.customerId ? Number(dto.customerId) : null,
          inventoryItemId: id,
          item: item.name,
          method: dto.paymentMethod,
          kind: 'item',
          status: 'paid',
          date: new Date(),
          amount: unitPrice * dto.quantity,
          currency: item.currency,
        },
      }),
    ]);
    await this.invalidate(bid);
    return {
      item: this.serializeItem(updatedItem),
      transaction: this.serializeTransaction(transaction),
      payment: this.serializePayment(payment),
    };
  }

  async transactions(
    businessId: number | null | undefined,
    query: InventoryTransactionQueryDto,
  ) {
    const bid = this.requireBusiness(businessId);
    const page = pagination(query);
    const where: Prisma.InventoryTransactionWhereInput = {
      businessId: bid,
      inventoryItemId: query.inventoryItemId,
      type: query.type,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inventoryTransaction.count({ where }),
      this.prisma.inventoryTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
    ]);
    return {
      data: rows.map((row) => this.serializeTransaction(row)),
      pagination: paginationMeta(total, page.page, page.limit),
    };
  }

  private itemData(
    businessId: number | undefined,
    dto: InventoryItemDto | InventoryItemUpdateDto,
  ) {
    return {
      businessId,
      category: dto.category,
      name: dto.name,
      company: dto.company ?? dto.brand,
      type: dto.type,
      specification: dto.specification ?? dto.viscosity,
      capacity: dto.capacity ?? dto.volume,
      apiSpec: dto.apiSpec,
      application: dto.application,
      details: dto.details,
      usedInServices: dto.usedInServices,
      imageUrl: dto.imageUrl,
      price: dto.price,
      purchasePrice: dto.purchasePrice,
      currency: dto.currency,
      deliveryTime: dto.deliveryTime,
      quantity: dto.quantity,
      lowStockThreshold: dto.lowStockThreshold,
      status: dto.status,
    };
  }

  private serializeItem(row: InventoryItem) {
    return {
      id: row.id,
      businessId: String(row.businessId),
      category: row.category,
      name: row.name,
      company: row.company,
      brand: row.company,
      type: row.type,
      specification: row.specification,
      viscosity: row.specification,
      capacity: row.capacity,
      volume: row.capacity,
      apiSpec: row.apiSpec,
      application: row.application,
      details: row.details,
      usedInServices: row.usedInServices,
      imageUrl: row.imageUrl,
      price: Number(row.price),
      purchasePrice: row.purchasePrice ? Number(row.purchasePrice) : null,
      currency: row.currency,
      deliveryTime: row.deliveryTime,
      quantity: row.quantity,
      lowStockThreshold: row.lowStockThreshold,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private serializeTransaction(row: InventoryTransaction) {
    return {
      id: row.id,
      inventoryItemId: row.inventoryItemId,
      type: row.type,
      quantity: row.quantity,
      unitPrice: row.unitPrice ? Number(row.unitPrice) : null,
      paymentId: row.paymentId,
      note: row.note,
      createdAt: row.createdAt,
    };
  }

  private serializePayment(row: Payment) {
    return {
      id: row.id,
      businessId: String(row.businessId),
      customerId: row.customerId ? String(row.customerId) : null,
      customer: '',
      bookingId: row.bookingId,
      inventoryItemId: row.inventoryItemId,
      item: row.item,
      method: row.method,
      date: row.date.toISOString().slice(0, 10),
      amount: Number(row.amount),
      currency: row.currency,
      kind: row.kind,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private options(
    options: Array<{ configKey: string; value: string }>,
    key: string,
  ) {
    return options
      .filter((option) => option.configKey === key)
      .map((option) => option.value);
  }

  private async invalidate(businessId: number) {
    await this.cache.del(
      cacheKeys.dashboardSummary(businessId),
      cacheKeys.setupWarnings(businessId),
    );
    await this.cache.deleteByPattern(
      `business:${businessId}:payments:summary:*`,
    );
    await this.cache.deleteByPattern(
      `business:${businessId}:reports:application-stats:*`,
    );
  }
}
