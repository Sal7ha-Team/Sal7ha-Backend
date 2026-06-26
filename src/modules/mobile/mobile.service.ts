import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, User, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { pagination, paginationMeta } from 'src/common/utils/pagination.util';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';

type JsonRecord = Record<string, any>;

@Injectable()
export class MobileService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  async getMe(userId: number) {
    const user = await this.getUser(userId);
    return this.serializeUser(user);
  }

  async updateMe(userId: number, dto: any) {
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const username = this.stringOrNull(dto?.username) ?? store.username;

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          email: this.stringOrUndefined(dto?.email),
          securityPreferences: this.withMobileStore(existing, {
            ...store,
            username,
          }),
        },
      });
      return this.serializeUser(user);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw e;
    }
  }

  async updateProfile(userId: number, dto: any) {
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const profile = this.record(store.profile);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: this.stringOrUndefined(dto?.firstName),
        lastName: this.stringOrUndefined(dto?.surname),
        birthDate: dto?.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        phoneNumber: this.stringOrUndefined(dto?.phone),
        address:
          dto?.address !== undefined
            ? (dto.address as Prisma.InputJsonValue)
            : undefined,
        securityPreferences: this.withMobileStore(existing, {
          ...store,
          profile: {
            ...profile,
            gender: this.stringOrNull(dto?.gender) ?? profile.gender ?? null,
            avatarFileId:
              this.stringOrNull(dto?.avatarFileId) ??
              profile.avatarFileId ??
              null,
          },
        }),
      },
    });
    return this.serializeProfile(user);
  }

  async updatePreferences(userId: number, dto: any) {
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        securityPreferences: this.withMobileStore(existing, {
          ...store,
          language: dto?.language ?? store.language ?? 'en',
          theme: dto?.theme ?? store.theme ?? 'system',
        }),
      },
    });
    return this.serializeProfile(user);
  }

  async listVehicles(userId: number) {
    const user = await this.getUser(userId);
    return this.mobileVehicles(user);
  }

  async createVehicle(userId: number, dto: any) {
    if (!dto?.make || !dto?.model) {
      throw new BadRequestException('make and model are required');
    }
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const vehicle = this.serializeVehicle({
      id: randomUUID(),
      userId: String(userId),
      make: String(dto.make),
      model: String(dto.model),
      fuelType: dto.fuelType ?? null,
      yearOfManufacture: dto.yearOfManufacture ?? null,
      transmissionType: dto.transmissionType ?? null,
      licensePlateNumber: dto.licensePlateNumber ?? dto.plate ?? null,
      vin: dto.vin ?? null,
      nickname: dto.nickname ?? null,
      logo: dto.logo ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await this.saveStore(userId, existing, {
      ...store,
      vehicles: [...this.array(store.vehicles), vehicle],
    });
    return vehicle;
  }

  async getVehicle(userId: number, vehicleId: string) {
    const user = await this.getUser(userId);
    const vehicle = this.mobileVehicles(user).find((v) => v.id === vehicleId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async updateVehicle(userId: number, vehicleId: string, dto: any) {
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const vehicles = this.mobileVehicles(existing);
    const index = vehicles.findIndex((vehicle) => vehicle.id === vehicleId);
    if (index === -1) throw new NotFoundException('Vehicle not found');

    const vehicle = this.serializeVehicle({
      ...vehicles[index],
      make: dto?.make ?? vehicles[index].make,
      model: dto?.model ?? vehicles[index].model,
      fuelType: dto?.fuelType ?? vehicles[index].fuelType ?? null,
      yearOfManufacture:
        dto?.yearOfManufacture ?? vehicles[index].yearOfManufacture ?? null,
      transmissionType:
        dto?.transmissionType ?? vehicles[index].transmissionType ?? null,
      licensePlateNumber:
        dto?.licensePlateNumber ?? vehicles[index].licensePlateNumber ?? null,
      vin: dto?.vin ?? vehicles[index].vin ?? null,
      nickname: dto?.nickname ?? vehicles[index].nickname ?? null,
      updatedAt: new Date().toISOString(),
    });
    vehicles[index] = vehicle;
    await this.saveStore(userId, existing, { ...store, vehicles });
    return vehicle;
  }

  async deleteVehicle(userId: number, vehicleId: string) {
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const vehicles = this.mobileVehicles(existing);
    const next = vehicles.filter((vehicle) => vehicle.id !== vehicleId);
    if (next.length === vehicles.length) {
      throw new NotFoundException('Vehicle not found');
    }
    await this.saveStore(userId, existing, { ...store, vehicles: next });
  }

  async listShops(query: any) {
    const page = pagination(query);
    const where: Prisma.BusinessWhereInput = {
      city: query?.city
        ? { contains: String(query.city), mode: 'insensitive' }
        : undefined,
      businessServices: query?.serviceId
        ? { some: { serviceId: String(query.serviceId) } }
        : undefined,
      OR: query?.q
        ? [
            { name: { contains: String(query.q), mode: 'insensitive' } },
            {
              businessServices: {
                some: {
                  name: { contains: String(query.q), mode: 'insensitive' },
                },
              },
            },
          ]
        : undefined,
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.business.count({ where }),
      this.prisma.business.findMany({
        where,
        include: { businessServices: { include: { service: true } } },
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
    ]);

    let data = rows.map((row) => this.serializeShopSummary(row));
    if (query?.sort === 'price_low') {
      data = data.sort((a, b) => (a.hourlyRate ?? 0) - (b.hourlyRate ?? 0));
    }
    if (query?.sort === 'price_high') {
      data = data.sort((a, b) => (b.hourlyRate ?? 0) - (a.hourlyRate ?? 0));
    }

    return { data, pagination: paginationMeta(total, page.page, page.limit) };
  }

  async getShop(shopId: string) {
    const shop = await this.prisma.business.findUnique({
      where: { id: Number(shopId) },
      include: {
        businessServices: {
          include: { service: { include: { category: true } } },
        },
        users: { take: 5 },
      },
    });
    if (!shop) throw new NotFoundException('Shop not found');
    return this.serializeShop(shop);
  }

  async listShopServices(shopId: string) {
    await this.requireShop(shopId);
    const rows = await this.prisma.businessService.findMany({
      where: { businessId: Number(shopId), enabled: true },
      include: { service: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.serializeShopService(row));
  }

  async getShopAvailability(shopId: string, query: any) {
    const shop = await this.requireShop(shopId);
    const date =
      this.stringOrNull(query?.date) ?? new Date().toISOString().slice(0, 10);
    const open = shop.workingHoursOpen ?? '09:00';
    const close = shop.workingHoursClose ?? '17:00';
    const startHour = Number(open.slice(0, 2));
    const endHour = Math.max(startHour + 1, Number(close.slice(0, 2)) || 17);
    const slots = Array.from({ length: Math.min(10, endHour - startHour) }).map(
      (_, index) => ({
        time: `${String(startHour + index).padStart(2, '0')}:00`,
        available: true,
        technicianId: null,
      }),
    );
    return { shopId: String(shop.id), date, slots };
  }

  async listShopReviews(userId: number, shopId: string, query: any) {
    await this.requireShop(shopId);
    const user = await this.getUser(userId);
    const reviews = this.array(this.mobileStore(user).reviews).filter(
      (review) => review.shopId === String(shopId),
    );
    return this.paginateArray(reviews, query);
  }

  async createShopReview(userId: number, shopId: string, dto: any) {
    await this.requireShop(shopId);
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const review = {
      id: randomUUID(),
      shopId: String(shopId),
      userId: String(userId),
      userName: this.displayName(existing),
      bookingId: dto?.bookingId ?? null,
      rating: Number(dto?.rating ?? 5),
      comment: dto?.comment ?? null,
      createdAt: new Date().toISOString(),
    };
    await this.saveStore(userId, existing, {
      ...store,
      reviews: [review, ...this.array(store.reviews)],
    });
    return review;
  }

  async quoteBooking(dto: any) {
    if (!dto?.shopId || !dto?.serviceId) {
      throw new BadRequestException('shopId and serviceId are required');
    }
    const service = await this.findBusinessService(dto.shopId, dto.serviceId);
    const min = Number(service?.priceMin ?? service?.price ?? 0);
    const max = Number(service?.priceMax ?? service?.price ?? min);
    const fees = 0;
    return {
      estimateMin: min,
      estimateMax: max,
      fees,
      totalMin: min + fees,
      totalMax: max + fees,
      currency: service?.currency ?? 'EGP',
    };
  }

  async listBookings(userId: number, query: any) {
    const user = await this.getUser(userId);
    const page = pagination(query);
    const status = this.toPrismaStatus(query?.status);
    const where: Prisma.BookingWhereInput = {
      customer: { email: user.email },
      status,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        include: {
          business: { include: { businessServices: true } },
          service: { include: { category: true } },
          customer: true,
          car: true,
          serviceDetails: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
    ]);
    return {
      data: rows.map((row) => this.serializeBooking(row, user)),
      pagination: paginationMeta(total, page.page, page.limit),
    };
  }

  async createBooking(userId: number, dto: any) {
    if (!dto?.shopId || !dto?.serviceId || !dto?.vehicleId) {
      throw new BadRequestException(
        'shopId, serviceId, and vehicleId are required',
      );
    }
    const user = await this.getUser(userId);
    const vehicle = await this.getVehicle(userId, String(dto.vehicleId));
    const shop = await this.requireShop(dto.shopId);
    await this.requireService(dto.serviceId);
    const quote = await this.quoteBooking(dto);
    const customer = await this.findOrCreateCustomer(shop.id, user);
    const car = await this.findOrCreateCar(customer.id, vehicle);

    const booking = await this.prisma.booking.create({
      data: {
        id: `MB-${randomUUID().slice(0, 8).toUpperCase()}`,
        businessId: shop.id,
        customerId: customer.id,
        carId: car.id,
        serviceId: String(dto.serviceId),
        startDate: new Date(dto.scheduledDate),
        endDate: new Date(dto.scheduledDate),
        price: quote.totalMin,
        status: BookingStatus.Pending,
        serviceDetails: {
          create: [
            dto.scheduledTime
              ? { label: 'Scheduled time', value: String(dto.scheduledTime) }
              : null,
            { label: 'Any time', value: String(Boolean(dto.anyTime)) },
            dto.notes ? { label: 'Notes', value: String(dto.notes) } : null,
            dto.oilBrandId
              ? { label: 'Oil brand', value: String(dto.oilBrandId) }
              : null,
            dto.paymentMethodId
              ? { label: 'Payment method', value: String(dto.paymentMethodId) }
              : null,
          ].filter(Boolean) as Array<{ label: string; value: string }>,
        },
      },
      include: {
        business: { include: { businessServices: true } },
        service: { include: { category: true } },
        customer: true,
        car: true,
        serviceDetails: true,
      },
    });
    await this.notifications.notifyBusinessOwnersOfBookingCreated(booking.id);
    return this.serializeBooking(booking, user);
  }

  async getBooking(userId: number, bookingId: string) {
    const user = await this.getUser(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customer: { email: user.email } },
      include: {
        business: { include: { businessServices: true } },
        service: { include: { category: true } },
        customer: true,
        car: true,
        serviceDetails: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return this.serializeBooking(booking, user);
  }

  async cancelBooking(userId: number, bookingId: string, dto: any) {
    await this.getBooking(userId, bookingId);
    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.Cancelled,
        serviceDetails: dto?.reason
          ? { create: { label: 'Cancellation reason', value: dto.reason } }
          : undefined,
      },
      include: {
        business: { include: { businessServices: true } },
        service: { include: { category: true } },
        customer: true,
        car: true,
        serviceDetails: true,
      },
    });
    await this.notifications.notifyBusinessOwnersOfBookingCancelled(booking.id);
    const user = await this.getUser(userId);
    return this.serializeBooking(booking, user);
  }

  async listPaymentMethods(userId: number) {
    const user = await this.getUser(userId);
    return this.array(this.mobileStore(user).paymentMethods);
  }

  async createPaymentMethod(userId: number, dto: any) {
    if (!dto?.type) throw new BadRequestException('type is required');
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const methods = this.array(store.paymentMethods);
    const paymentMethod = {
      id: randomUUID(),
      type: dto.type,
      provider: dto.provider ?? null,
      cardBrand: dto.cardBrand ?? null,
      cardLast4: dto.cardLast4 ?? null,
      expiryMonth: dto.expiryMonth ?? null,
      expiryYear: dto.expiryYear ?? null,
      cardholderName: dto.cardholderName ?? null,
      billingAddress: dto.billingAddress ?? null,
      isDefault: Boolean(dto.isDefault ?? methods.length === 0),
    };
    const next = paymentMethod.isDefault
      ? methods.map((method) => ({ ...method, isDefault: false }))
      : methods;
    await this.saveStore(userId, existing, {
      ...store,
      paymentMethods: [paymentMethod, ...next],
    });
    return paymentMethod;
  }

  async deletePaymentMethod(userId: number, paymentMethodId: string) {
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const methods = this.array(store.paymentMethods);
    const next = methods.filter((method) => method.id !== paymentMethodId);
    if (next.length === methods.length) {
      throw new NotFoundException('Payment method not found');
    }
    await this.saveStore(userId, existing, { ...store, paymentMethods: next });
  }

  async listNotifications(userId: number, query: any) {
    const page = pagination(query);
    const unreadOnly =
      query?.unreadOnly === true || query?.unreadOnly === 'true';
    const where: Prisma.InboxMessageWhereInput = {
      userId,
      status: unreadOnly ? 'unread' : undefined,
    };
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
      data: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        data: row.data,
        status: row.status,
        readAt: row.readAt,
        createdAt: row.createdAt,
      })),
      pagination: paginationMeta(total, page.page, page.limit),
    };
  }

  async markNotificationRead(userId: number, notificationId: string) {
    const row = await this.prisma.inboxMessage.findFirst({
      where: { id: notificationId, userId },
    });
    if (!row) throw new NotFoundException('Notification not found');
    const updated = await this.prisma.inboxMessage.update({
      where: { id: notificationId },
      data: { status: 'read', readAt: new Date() },
    });
    return {
      id: updated.id,
      type: updated.type,
      title: updated.title,
      body: updated.body,
      data: updated.data,
      status: updated.status,
      readAt: updated.readAt,
      createdAt: updated.createdAt,
    };
  }

  async listShopChatThreads(userId: number) {
    const user = await this.getUser(userId);
    const threads = this.array(this.mobileStore(user).shopChatThreads);
    return Promise.all(
      threads.map(async (thread) => ({
        id: thread.id,
        shop: await this.safeShopSummary(thread.shopId),
        lastMessage: this.array(thread.messages).at(-1) ?? null,
        createdAt: thread.createdAt,
      })),
    );
  }

  async createShopChatThread(userId: number, dto: any) {
    if (!dto?.shopId) throw new BadRequestException('shopId is required');
    await this.requireShop(dto.shopId);
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const threads = this.array(store.shopChatThreads);
    const found = threads.find(
      (thread) => thread.shopId === String(dto.shopId),
    );
    if (found) {
      return {
        id: found.id,
        shop: await this.safeShopSummary(found.shopId),
        lastMessage: this.array(found.messages).at(-1) ?? null,
        createdAt: found.createdAt,
      };
    }
    const thread = {
      id: randomUUID(),
      shopId: String(dto.shopId),
      messages: [],
      createdAt: new Date().toISOString(),
    };
    await this.saveStore(userId, existing, {
      ...store,
      shopChatThreads: [thread, ...threads],
    });
    return {
      id: thread.id,
      shop: await this.safeShopSummary(thread.shopId),
      lastMessage: null,
      createdAt: thread.createdAt,
    };
  }

  async listShopChatMessages(userId: number, threadId: string) {
    const thread = await this.getThread(userId, threadId);
    return this.array(thread.messages);
  }

  async createShopChatMessage(userId: number, threadId: string, dto: any) {
    if (!dto?.body) throw new BadRequestException('body is required');
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const threads = this.array(store.shopChatThreads);
    const index = threads.findIndex((thread) => thread.id === threadId);
    if (index === -1) throw new NotFoundException('Chat thread not found');
    const message = {
      id: randomUUID(),
      threadId,
      senderUserId: String(userId),
      body: String(dto.body),
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    threads[index] = {
      ...threads[index],
      messages: [...this.array(threads[index].messages), message],
      lastMessageAt: message.createdAt,
    };
    await this.saveStore(userId, existing, {
      ...store,
      shopChatThreads: threads,
    });
    return message;
  }

  async createUploadedImage(userId: number, file: any, body: any) {
    if (!body?.purpose) throw new BadRequestException('purpose is required');
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const uploaded = {
      id: randomUUID(),
      url: `/uploads/images/${randomUUID()}`,
      contentType: file?.mimetype ?? 'application/octet-stream',
      sizeBytes: Number(file?.size ?? 0),
      originalFilename: file?.originalname ?? null,
      purpose: String(body.purpose),
      createdAt: new Date().toISOString(),
    };
    await this.saveStore(userId, existing, {
      ...store,
      uploads: [uploaded, ...this.array(store.uploads)],
    });
    return uploaded;
  }

  async listAiChatSessions(userId: number, query: any) {
    const user = await this.getUser(userId);
    const sessions = this.array(this.mobileStore(user).aiChatSessions).map(
      (session) => this.serializeAiSession(session),
    );
    return this.paginateArray(sessions, query);
  }

  async createAiChatSession(userId: number, dto: any) {
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const session = {
      id: randomUUID(),
      userId: String(userId),
      title: dto?.title ?? null,
      aiBaseUrl: dto?.aiBaseUrl ?? null,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.saveStore(userId, existing, {
      ...store,
      aiChatSessions: [session, ...this.array(store.aiChatSessions)],
    });
    return this.serializeAiSession(session);
  }

  async getAiChatSession(userId: number, sessionId: string) {
    const session = await this.getAiSession(userId, sessionId);
    return {
      ...this.serializeAiSession(session),
      messages: this.array(session.messages),
    };
  }

  async deleteAiChatSession(userId: number, sessionId: string) {
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const sessions = this.array(store.aiChatSessions);
    const next = sessions.filter((session) => session.id !== sessionId);
    if (next.length === sessions.length) {
      throw new NotFoundException('AI chat session not found');
    }
    await this.saveStore(userId, existing, { ...store, aiChatSessions: next });
  }

  async listAiChatMessages(userId: number, sessionId: string) {
    const session = await this.getAiSession(userId, sessionId);
    return this.array(session.messages);
  }

  async createAiChatMessages(userId: number, sessionId: string, dto: any) {
    const incoming = this.array(dto?.messages);
    if (incoming.length === 0) {
      throw new BadRequestException('messages is required');
    }
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const sessions = this.array(store.aiChatSessions);
    const index = sessions.findIndex((session) => session.id === sessionId);
    if (index === -1) throw new NotFoundException('AI chat session not found');
    const messages = incoming.map((message) => ({
      id: randomUUID(),
      sessionId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt ?? new Date().toISOString(),
    }));
    sessions[index] = {
      ...sessions[index],
      messages: [...this.array(sessions[index].messages), ...messages],
      updatedAt: new Date().toISOString(),
    };
    await this.saveStore(userId, existing, {
      ...store,
      aiChatSessions: sessions,
    });
    return messages;
  }

  async listAiDetections(userId: number, query: any) {
    const user = await this.getUser(userId);
    return this.paginateArray(
      this.array(this.mobileStore(user).aiDetections),
      query,
    );
  }

  async createAiDetection(userId: number, dto: any) {
    if (!dto?.originalFileId) {
      throw new BadRequestException('originalFileId is required');
    }
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const uploads = this.array(store.uploads);
    const detection = {
      id: randomUUID(),
      userId: String(userId),
      originalFile:
        uploads.find((upload) => upload.id === dto.originalFileId) ??
        this.fileReference(dto.originalFileId),
      annotatedFile: dto.annotatedFileId
        ? (uploads.find((upload) => upload.id === dto.annotatedFileId) ??
          this.fileReference(dto.annotatedFileId))
        : null,
      selectedParts: this.array(dto.selectedParts),
      detectedParts: this.array(dto.detectedParts),
      detectionCount: Number(dto.detectionCount ?? 0),
      confidenceThreshold: Number(dto.confidenceThreshold ?? 0.25),
      objects: this.array(dto.objects).map((object) => ({
        id: randomUUID(),
        ...object,
      })),
      aiBaseUrl: dto.aiBaseUrl ?? null,
      createdAt: new Date().toISOString(),
    };
    await this.saveStore(userId, existing, {
      ...store,
      aiDetections: [detection, ...this.array(store.aiDetections)],
    });
    return detection;
  }

  async getAiDetection(userId: number, detectionId: string) {
    const user = await this.getUser(userId);
    const detection = this.array(this.mobileStore(user).aiDetections).find(
      (item) => item.id === detectionId,
    );
    if (!detection) throw new NotFoundException('AI detection not found');
    return detection;
  }

  async deleteAiDetection(userId: number, detectionId: string) {
    const existing = await this.getUser(userId);
    const store = this.mobileStore(existing);
    const detections = this.array(store.aiDetections);
    const next = detections.filter((item) => item.id !== detectionId);
    if (next.length === detections.length) {
      throw new NotFoundException('AI detection not found');
    }
    await this.saveStore(userId, existing, { ...store, aiDetections: next });
  }

  private async getUser(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async requireShop(shopId: string | number) {
    const shop = await this.prisma.business.findUnique({
      where: { id: Number(shopId) },
    });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }

  private async requireService(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: String(serviceId) },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  private async findBusinessService(
    shopId: string | number,
    serviceId: string,
  ) {
    return this.prisma.businessService.findFirst({
      where: { businessId: Number(shopId), serviceId: String(serviceId) },
    });
  }

  private async findOrCreateCustomer(businessId: number, user: User) {
    const found = await this.prisma.customer.findFirst({
      where: { businessId, email: user.email },
    });
    if (found) return found;
    return this.prisma.customer.create({
      data: {
        businessId,
        firstName: user.firstName ?? 'Mobile',
        lastName: user.lastName ?? 'Customer',
        email: user.email,
        phoneNumber: user.phoneNumber,
      },
    });
  }

  private async findOrCreateCar(customerId: number, vehicle: any) {
    const found = await this.prisma.car.findFirst({
      where: {
        customerId,
        OR: [
          vehicle.vin ? { vin: vehicle.vin } : undefined,
          vehicle.licensePlateNumber
            ? { plate: vehicle.licensePlateNumber }
            : undefined,
        ].filter(Boolean) as Prisma.CarWhereInput[],
      },
    });
    if (found) return found;
    return this.prisma.car.create({
      data: {
        customerId,
        make: vehicle.make,
        model: vehicle.model,
        year: String(vehicle.yearOfManufacture ?? ''),
        plate: vehicle.licensePlateNumber ?? null,
        vin: vehicle.vin ?? null,
      },
    });
  }

  private async safeShopSummary(shopId: string) {
    const shop = await this.prisma.business.findUnique({
      where: { id: Number(shopId) },
      include: { businessServices: true },
    });
    return shop ? this.serializeShopSummary(shop) : null;
  }

  private async getThread(userId: number, threadId: string) {
    const user = await this.getUser(userId);
    const thread = this.array(this.mobileStore(user).shopChatThreads).find(
      (item) => item.id === threadId,
    );
    if (!thread) throw new NotFoundException('Chat thread not found');
    return thread;
  }

  private async getAiSession(userId: number, sessionId: string) {
    const user = await this.getUser(userId);
    const session = this.array(this.mobileStore(user).aiChatSessions).find(
      (item) => item.id === sessionId,
    );
    if (!session) throw new NotFoundException('AI chat session not found');
    return session;
  }

  private mobileStore(user: User): JsonRecord {
    return this.record(this.record(user.securityPreferences).mobile);
  }

  private mobileVehicles(user: User) {
    return this.array(this.mobileStore(user).vehicles).map((vehicle) =>
      this.serializeVehicle(vehicle),
    );
  }

  private withMobileStore(
    user: User,
    store: JsonRecord,
  ): Prisma.InputJsonValue {
    return {
      ...this.record(user.securityPreferences),
      mobile: store,
    } as Prisma.InputJsonValue;
  }

  private async saveStore(userId: number, user: User, store: JsonRecord) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { securityPreferences: this.withMobileStore(user, store) },
    });
  }

  private serializeUser(user: User) {
    const store = this.mobileStore(user);
    return {
      id: String(user.id),
      username: store.username ?? user.firstName ?? null,
      email: user.email,
      role: this.mobileRole(user.role),
      emailVerified: Boolean(store.emailVerified),
      profile: this.serializeProfile(user),
      createdAt: user.createdAt,
    };
  }

  private serializeProfile(user: User) {
    const store = this.mobileStore(user);
    const profile = this.record(store.profile);
    return {
      firstName: user.firstName,
      surname: user.lastName,
      dateOfBirth: user.birthDate?.toISOString().slice(0, 10) ?? null,
      gender: profile.gender ?? null,
      phone: user.phoneNumber,
      avatar:
        this.array(store.uploads).find(
          (upload) => upload.id === profile.avatarFileId,
        ) ?? null,
      address: this.record(user.address),
      language: store.language ?? 'en',
      theme: store.theme ?? 'system',
    };
  }

  private serializeVehicle(vehicle: any) {
    return {
      id: String(vehicle.id),
      userId: String(vehicle.userId),
      make: vehicle.make,
      model: vehicle.model,
      fuelType: vehicle.fuelType ?? null,
      yearOfManufacture:
        vehicle.yearOfManufacture === null ||
        vehicle.yearOfManufacture === undefined
          ? null
          : Number(vehicle.yearOfManufacture),
      transmissionType: vehicle.transmissionType ?? null,
      licensePlateNumber: vehicle.licensePlateNumber ?? vehicle.plate ?? null,
      vin: vehicle.vin ?? null,
      nickname: vehicle.nickname ?? null,
      logo: vehicle.logo ?? null,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
  }

  private serializeShopSummary(shop: any) {
    const prices = this.array(shop.businessServices)
      .map((service) => Number(service.priceMin ?? service.price ?? 0))
      .filter((price) => price > 0);
    return {
      id: String(shop.id),
      name: shop.name,
      nameAr: null,
      facilityType: shop.businessType ?? 'general_repair',
      description: null,
      city: shop.city ?? '',
      area: shop.state ?? null,
      address: [shop.streetAddress, shop.city, shop.state, shop.country]
        .filter(Boolean)
        .join(', '),
      distanceKm: null,
      hourlyRate: prices.length ? Math.min(...prices) : null,
      ratingAverage: 0,
      reviewCount: 0,
      logo: null,
      tags: this.array(shop.businessServices)
        .map((service) => service.name ?? service.service?.name)
        .filter(Boolean),
    };
  }

  private serializeShop(shop: any) {
    return {
      ...this.serializeShopSummary(shop),
      phone: shop.phoneNumber,
      whatsapp: shop.phoneNumber,
      email: shop.email,
      facebookUrl: null,
      instagramUrl: null,
      cover: null,
      workingHours: this.workingHours(shop),
      technicians: this.array(shop.users).map((user) => ({
        id: String(user.id),
        name: this.displayName(user),
        specialty: 'Service advisor',
        status: 'available',
      })),
      services: this.array(shop.businessServices).map((service) =>
        this.serializeShopService(service),
      ),
    };
  }

  private serializeShopService(row: any) {
    return {
      shopId: String(row.businessId),
      service: this.serializeService(row.service, row),
      priceRange: {
        min: row.priceMin === null ? null : Number(row.priceMin ?? row.price),
        max: row.priceMax === null ? null : Number(row.priceMax ?? row.price),
        currency: row.currency ?? 'EGP',
      },
      durationMinutes: null,
    };
  }

  private serializeService(service: any, fallback: any = {}) {
    return {
      id: String(service?.id ?? fallback.serviceId ?? fallback.id),
      category: service?.category
        ? {
            id: String(service.category.id),
            name: service.category.name,
            nameAr: null,
            iconKey: service.category.icon ?? null,
          }
        : {
            id: fallback.category ?? 'general',
            name: fallback.category ?? 'General',
            nameAr: null,
            iconKey: null,
          },
      name: service?.name ?? fallback.name ?? '',
      nameAr: null,
      description: null,
      priceRange: {
        min:
          fallback.priceMin === null
            ? null
            : Number(fallback.priceMin ?? fallback.price ?? 0),
        max:
          fallback.priceMax === null
            ? null
            : Number(fallback.priceMax ?? fallback.price ?? 0),
        currency: fallback.currency ?? 'EGP',
      },
      durationMinutes: null,
    };
  }

  private serializeBooking(booking: any, user: User) {
    const scheduledTime = booking.serviceDetails.find(
      (detail) => detail.label === 'Scheduled time',
    )?.value;
    return {
      id: booking.id,
      userId: String(user.id),
      shop: this.serializeShopSummary(booking.business),
      service: this.serializeService(booking.service),
      vehicle: {
        id: String(booking.car.id),
        userId: String(user.id),
        make: booking.car.make,
        model: booking.car.model,
        yearOfManufacture: Number(booking.car.year) || null,
        licensePlateNumber: booking.car.plate,
        vin: booking.car.vin,
      },
      technician: null,
      oilBrand: null,
      scheduledDate: booking.startDate.toISOString().slice(0, 10),
      scheduledTime: scheduledTime ?? null,
      anyTime:
        booking.serviceDetails.find((detail) => detail.label === 'Any time')
          ?.value === 'true',
      notes:
        booking.serviceDetails.find((detail) => detail.label === 'Notes')
          ?.value ?? null,
      status: this.toMobileStatus(booking.status),
      estimate: {
        estimateMin: Number(booking.price),
        estimateMax: Number(booking.price),
        fees: 0,
        totalMin: Number(booking.price),
        totalMax: Number(booking.price),
        currency: 'EGP',
      },
      paymentMethod: null,
      createdAt: booking.createdAt,
    };
  }

  private serializeAiSession(session: any) {
    return {
      id: session.id,
      userId: session.userId,
      title: session.title ?? null,
      aiBaseUrl: session.aiBaseUrl ?? null,
      messageCount: this.array(session.messages).length,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private workingHours(shop: any) {
    return Array.from({ length: 7 }).map((_, dayOfWeek) => ({
      dayOfWeek,
      opensAt: shop.workingHoursOpen ?? '09:00',
      closesAt: shop.workingHoursClose ?? '17:00',
      isClosed: false,
    }));
  }

  private toMobileStatus(status: BookingStatus) {
    switch (status) {
      case BookingStatus.Accepted:
        return 'confirmed';
      case BookingStatus.In_Progress:
        return 'in_progress';
      case BookingStatus.Completed:
        return 'completed';
      case BookingStatus.Cancelled:
        return 'cancelled';
      case BookingStatus.Pending:
      default:
        return 'pending';
    }
  }

  private toPrismaStatus(status?: string) {
    switch (status) {
      case 'confirmed':
      case 'active':
        return BookingStatus.Accepted;
      case 'in_progress':
        return BookingStatus.In_Progress;
      case 'completed':
        return BookingStatus.Completed;
      case 'cancelled':
        return BookingStatus.Cancelled;
      case 'pending':
        return BookingStatus.Pending;
      case 'all':
      case undefined:
      case null:
      default:
        return undefined;
    }
  }

  private mobileRole(role: UserRole) {
    if (role === UserRole.business) return 'shop_owner';
    if (role === UserRole.admin) return 'admin';
    return 'customer';
  }

  private displayName(user: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  }) {
    return (
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.email ||
      'Customer'
    );
  }

  private paginateArray(items: any[], query: any) {
    const page = pagination(query);
    return {
      data: items.slice(page.skip, page.skip + page.take),
      pagination: paginationMeta(items.length, page.page, page.limit),
    };
  }

  private fileReference(id: string) {
    return {
      id,
      url: `/uploads/images/${id}`,
      contentType: 'application/octet-stream',
      sizeBytes: 0,
      originalFilename: null,
      createdAt: new Date().toISOString(),
    };
  }

  private stringOrUndefined(value: unknown) {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private stringOrNull(value: unknown) {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private record(value: unknown): JsonRecord {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as JsonRecord;
    }
    return {};
  }

  private array(value: unknown): any[] {
    return Array.isArray(value) ? value : [];
  }
}
