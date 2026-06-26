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
  Put,
  Query,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { MobileService } from './mobile.service';

@Controller('me')
export class MobileAccountController {
  constructor(private readonly mobile: MobileService) {}

  @Get()
  me(@CurrentUser() user: JwtUser) {
    return this.mobile.getMe(user.sub);
  }

  @Patch()
  updateMe(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.mobile.updateMe(user.sub, dto);
  }

  @Put('profile')
  updateProfile(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.mobile.updateProfile(user.sub, dto);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.mobile.updatePreferences(user.sub, dto);
  }
}

@Controller('shops')
export class ShopsController {
  constructor(private readonly mobile: MobileService) {}

  @Get()
  list(@Query() query: any) {
    return this.mobile.listShops(query);
  }

  @Get(':shopId')
  get(@Param('shopId') shopId: string) {
    return this.mobile.getShop(shopId);
  }

  @Get(':shopId/services')
  services(@Param('shopId') shopId: string) {
    return this.mobile.listShopServices(shopId);
  }

  @Get(':shopId/availability')
  availability(@Param('shopId') shopId: string, @Query() query: any) {
    return this.mobile.getShopAvailability(shopId, query);
  }

  @Get(':shopId/reviews')
  reviews(
    @CurrentUser() user: JwtUser,
    @Param('shopId') shopId: string,
    @Query() query: any,
  ) {
    return this.mobile.listShopReviews(user.sub, shopId, query);
  }

  @Post(':shopId/reviews')
  review(
    @CurrentUser() user: JwtUser,
    @Param('shopId') shopId: string,
    @Body() dto: any,
  ) {
    return this.mobile.createShopReview(user.sub, shopId, dto);
  }
}

@Controller('payment-methods')
export class MobilePaymentsController {
  constructor(private readonly mobile: MobileService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.mobile.listPaymentMethods(user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.mobile.createPaymentMethod(user.sub, dto);
  }

  @Delete(':paymentMethodId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtUser,
    @Param('paymentMethodId') paymentMethodId: string,
  ) {
    return this.mobile.deletePaymentMethod(user.sub, paymentMethodId);
  }
}

@Controller('notifications')
export class MobileNotificationsController {
  constructor(private readonly mobile: MobileService) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query() query: any) {
    return this.mobile.listNotifications(user.sub, query);
  }

  @Patch(':notificationId/read')
  markRead(
    @CurrentUser() user: JwtUser,
    @Param('notificationId') notificationId: string,
  ) {
    return this.mobile.markNotificationRead(user.sub, notificationId);
  }
}

@Controller('shop-chat')
export class ShopChatController {
  constructor(private readonly mobile: MobileService) {}

  @Get('threads')
  threads(@CurrentUser() user: JwtUser) {
    return this.mobile.listShopChatThreads(user.sub);
  }

  @Post('threads')
  createThread(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.mobile.createShopChatThread(user.sub, dto);
  }

  @Get('threads/:threadId/messages')
  messages(@CurrentUser() user: JwtUser, @Param('threadId') threadId: string) {
    return this.mobile.listShopChatMessages(user.sub, threadId);
  }

  @Post('threads/:threadId/messages')
  createMessage(
    @CurrentUser() user: JwtUser,
    @Param('threadId') threadId: string,
    @Body() dto: any,
  ) {
    return this.mobile.createShopChatMessage(user.sub, threadId, dto);
  }
}

@Controller('uploads')
export class MobileUploadsController {
  constructor(private readonly mobile: MobileService) {}

  @Post('images')
  @UseInterceptors(FileInterceptor('image'))
  uploadImage(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: any,
    @Body() body: any,
  ) {
    return this.mobile.createUploadedImage(user.sub, file, body);
  }
}

@Controller('ai')
export class AiPersistenceController {
  constructor(private readonly mobile: MobileService) {}

  @Get('chat-sessions')
  chatSessions(@CurrentUser() user: JwtUser, @Query() query: any) {
    return this.mobile.listAiChatSessions(user.sub, query);
  }

  @Post('chat-sessions')
  createChatSession(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.mobile.createAiChatSession(user.sub, dto);
  }

  @Get('chat-sessions/:sessionId')
  chatSession(
    @CurrentUser() user: JwtUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.mobile.getAiChatSession(user.sub, sessionId);
  }

  @Delete('chat-sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteChatSession(
    @CurrentUser() user: JwtUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.mobile.deleteAiChatSession(user.sub, sessionId);
  }

  @Get('chat-sessions/:sessionId/messages')
  chatMessages(
    @CurrentUser() user: JwtUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.mobile.listAiChatMessages(user.sub, sessionId);
  }

  @Post('chat-sessions/:sessionId/messages')
  createChatMessages(
    @CurrentUser() user: JwtUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: any,
  ) {
    return this.mobile.createAiChatMessages(user.sub, sessionId, dto);
  }

  @Get('detections')
  detections(@CurrentUser() user: JwtUser, @Query() query: any) {
    return this.mobile.listAiDetections(user.sub, query);
  }

  @Post('detections')
  createDetection(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.mobile.createAiDetection(user.sub, dto);
  }

  @Get('detections/:detectionId')
  detection(
    @CurrentUser() user: JwtUser,
    @Param('detectionId') detectionId: string,
  ) {
    return this.mobile.getAiDetection(user.sub, detectionId);
  }

  @Delete('detections/:detectionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDetection(
    @CurrentUser() user: JwtUser,
    @Param('detectionId') detectionId: string,
  ) {
    return this.mobile.deleteAiDetection(user.sub, detectionId);
  }
}

@Public()
@Controller()
export class AiLiveController {
  @Get('health')
  detectionHealth() {
    return { status: 'ok', modelLoaded: false };
  }

  @Get('api/health')
  chatHealth() {
    return {
      status: 'ok',
      service: 'Car Service Platform Chatbot',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('classes')
  classes() {
    const parts = [
      'Battery',
      'Brake Disc',
      'Brake Pad',
      'Bumper',
      'Engine',
      'Headlight',
      'Radiator',
      'Tire',
      'Wheel',
      'Windshield',
    ].map((name, id) => ({ id, name }));
    return { count: parts.length, parts };
  }

  @Post('detect')
  detect(@Body() body: any) {
    const requested = String(body?.parts ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    return {
      selection: {
        requested,
        matched: [],
        unmatched: requested,
        all: requested.length === 0 || requested.includes('*'),
      },
      confThreshold: Number(body?.conf ?? 0.25),
      image: { width: 0, height: 0 },
      count: 0,
      detections: [],
    };
  }

  @Post('detect/image')
  detectImage() {
    throw new ServiceUnavailableException(
      'Live detection image generation is not configured on this backend',
    );
  }

  @Post('api/chat')
  chat(@Body() body: any) {
    const message = String(body?.message ?? '').trim();
    return {
      reply: message
        ? 'The live AI service is not configured on this backend. Call the existing AI service directly or configure a proxy.'
        : 'Please send a message.',
    };
  }

  @Get('api/brand/:name')
  brand(@Param('name') name: string) {
    return { found: false, data: null, query: name };
  }
}
