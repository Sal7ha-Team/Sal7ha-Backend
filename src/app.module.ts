import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './common/cache/cache.module';
import { QueueModule } from './common/queues/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccountModule } from './modules/account/account.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ServicesModule } from './modules/services/services.module';
import { BusinessModule } from './modules/business/business.module';
import { SystemModule } from './modules/system/system.module';
import { CustomersModule } from './modules/customers/customers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { BillingModule } from './modules/billing/billing.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { SupportModule } from './modules/support/support.module';
import { LocationsModule } from './modules/locations/locations.module';
import { MobileModule } from './modules/mobile/mobile.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { JwtGuard } from './common/guards/jwt.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CacheModule,
    NotificationsModule,
    QueueModule,
    SystemModule,
    AuthModule,
    AccountModule,
    OnboardingModule,
    BookingsModule,
    DashboardModule,
    ServicesModule,
    BusinessModule,
    CustomersModule,
    VehiclesModule,
    InventoryModule,
    PaymentsModule,
    ReportsModule,
    BillingModule,
    InboxModule,
    SupportModule,
    LocationsModule,
    MobileModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
