import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor(private readonly config: ConfigService) {
    const databaseUrl =
      config.get<string>('DATABASE_URL') ??
      (() => {
        throw new Error('DATABASE_URL is missing');
      })();

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is missing at runtime');
    }

    let host = 'invalid DATABASE_URL';
    try {
      host = new URL(databaseUrl).host;
    } catch {}
    console.log('DB HOST:', host);

    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);

    super({ adapter });

    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
