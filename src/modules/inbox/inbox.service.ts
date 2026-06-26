import { Injectable, NotFoundException } from '@nestjs/common';
import { InboxMessage } from '@prisma/client';
import { pagination, paginationMeta } from 'src/common/utils/pagination.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { InboxQueryDto } from './dto/inbox.dto';

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number, query: InboxQueryDto) {
    const page = pagination(query);
    const where = { userId, status: query.status };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inboxMessage.count({ where }),
      this.prisma.inboxMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
    ]);
    return {
      data: rows.map((row) => this.serialize(row)),
      pagination: paginationMeta(total, page.page, page.limit),
    };
  }

  async markRead(userId: number, id: string) {
    const row = await this.prisma.inboxMessage.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException('Inbox message not found');
    return this.serialize(
      await this.prisma.inboxMessage.update({
        where: { id },
        data: { status: 'read', readAt: new Date() },
      }),
    );
  }

  private serialize(row: InboxMessage) {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      data: row.data,
      status: row.status,
      type: row.type,
      createdAt: row.createdAt,
      readAt: row.readAt,
    };
  }
}
