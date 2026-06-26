import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserRole } from '@prisma/client';
import * as argon from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtUser } from 'src/common/decorators/current-user.decorator';
import { RefreshTokenDto, SignInDto } from './dto/sign-in.dto';
import { BusinessSignUpDto } from './dto/business-sign-up.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async signUpBusiness(dto: BusinessSignUpDto) {
    const commercialRegistrationNumber =
      dto.commercialRegistrationNumber ?? dto.commercialRegistraionNumber;
    if (commercialRegistrationNumber === undefined) {
      throw new BadRequestException('commercialRegistrationNumber is required');
    }

    const passwordHash = await argon.hash(dto.password);
    const existingBusiness = await this.prisma.business.findUnique({
      where: { email: dto.email },
      include: { users: true },
    });
    const existingOwner = await this.prisma.user.findUnique({
      where: { email: dto.businessOwner.email },
    });
    if (existingBusiness || existingOwner) {
      return this.resumeBusinessSignUp(dto, existingBusiness, existingOwner);
    }

    try {
      const business = await this.prisma.business.create({
        data: {
          name: dto.name,
          email: dto.email,
          phoneNumber: dto.phoneNumber,
          country: dto.country,
          city: dto.city,
          commercialRegistraionNumber: BigInt(commercialRegistrationNumber),
          taxIdentificationNumber: BigInt(dto.taxIdentificationNumber),
          users: {
            create: {
              email: dto.businessOwner.email,
              passwordHash,
              role: UserRole.business,
              firstName: dto.businessOwner.firstName,
              lastName: dto.businessOwner.lastName,
              phoneNumber: dto.businessOwner.phoneNumber,
            },
          },
        },
        include: { users: true },
      });
      const owner = business.users[0];
      return this.createSession(owner);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return this.resumeBusinessSignUp(dto);
      }
      throw e;
    }
  }

  private async resumeBusinessSignUp(
    dto: BusinessSignUpDto,
    business?: Awaited<ReturnType<AuthService['findBusinessWithUsers']>> | null,
    owner?: User | null,
  ) {
    const existingBusiness =
      business ?? (await this.findBusinessWithUsers(dto.email));
    const existingOwner =
      owner ??
      (await this.prisma.user.findUnique({
        where: { email: dto.businessOwner.email },
      }));

    const user =
      existingOwner ??
      existingBusiness?.users.find(
        (candidate) => candidate.role === 'business',
      );

    if (!user && existingBusiness) {
      const createdOwner = await this.prisma.user.create({
        data: {
          email: dto.businessOwner.email,
          passwordHash: await argon.hash(dto.password),
          role: UserRole.business,
          firstName: dto.businessOwner.firstName,
          lastName: dto.businessOwner.lastName,
          phoneNumber: dto.businessOwner.phoneNumber,
          businessId: existingBusiness.id,
        },
      });
      return this.createSession(createdOwner);
    }

    if (!user) {
      throw new ConflictException('Email already in use');
    }

    const ok = await this.verifyPassword(user.passwordHash, dto.password);
    if (!ok) {
      throw new ConflictException(
        'Email already in use. Please sign in with the existing account.',
      );
    }

    const linkedBusiness =
      existingBusiness ?? (await this.createBusinessOnly(dto));

    if (user.role !== UserRole.business) {
      const promoted = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          role: UserRole.business,
          businessId: linkedBusiness.id,
        },
      });
      return this.createSession(promoted);
    }

    if (!user.businessId) {
      const linked = await this.prisma.user.update({
        where: { id: user.id },
        data: { businessId: linkedBusiness.id },
      });
      return this.createSession(linked);
    }

    return this.createSession(user);
  }

  private createBusinessOnly(dto: BusinessSignUpDto) {
    const commercialRegistrationNumber =
      dto.commercialRegistrationNumber ?? dto.commercialRegistraionNumber;
    if (commercialRegistrationNumber === undefined) {
      throw new BadRequestException('commercialRegistrationNumber is required');
    }

    return this.prisma.business.create({
      data: {
        name: dto.name,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        country: dto.country,
        city: dto.city,
        commercialRegistraionNumber: BigInt(commercialRegistrationNumber),
        taxIdentificationNumber: BigInt(dto.taxIdentificationNumber),
      },
    });
  }

  private findBusinessWithUsers(email: string) {
    return this.prisma.business.findUnique({
      where: { email },
      include: { users: true },
    });
  }

  async signUpClient(dto: {
    username?: string;
    email?: string;
    password?: string;
  }) {
    if (!dto.email || !dto.password) {
      throw new BadRequestException('email and password are required');
    }

    const username = dto.username?.trim() || dto.email.split('@')[0];
    const [firstName, ...lastNameParts] = username.split(/\s+/);
    const passwordHash = await argon.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: UserRole.client,
          firstName: firstName || username,
          lastName: lastNameParts.join(' ') || null,
          securityPreferences: {
            mobile: {
              username,
              emailVerified: false,
              language: 'en',
              theme: 'system',
            },
          },
        },
      });
      return this.createMobileSession(user);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const existing = await this.prisma.user.findUnique({
          where: { email: dto.email },
        });
        if (existing && existing.role === UserRole.client) {
          const ok = await this.verifyPassword(
            existing.passwordHash,
            dto.password,
          );
          if (ok) return this.createMobileSession(existing);
        }
        throw new ConflictException('Email already in use');
      }
      throw e;
    }
  }

  async signIn(dto: SignInDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.role !== dto.role) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await this.verifyPassword(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.createSession(user, dto.rememberMe);
  }

  async signInClient(dto: {
    email?: string;
    password?: string;
    rememberMe?: boolean;
  }) {
    if (!dto.email || !dto.password) {
      throw new BadRequestException('email and password are required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || user.role !== UserRole.client) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await this.verifyPassword(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.createMobileSession(user, dto.rememberMe);
  }

  async refresh(dto: RefreshTokenDto) {
    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.createSession(stored.user);
  }

  async signOut(refreshToken?: string) {
    if (!refreshToken) return;

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async requestPasswordReset(_email?: string) {
    return;
  }

  async verifyEmail(dto: { email?: string; code?: string }) {
    if (!dto.email || !dto.code) {
      throw new BadRequestException('email and code are required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        securityPreferences: this.withMobileStore(user, {
          ...this.mobileStore(user),
          emailVerified: true,
        }),
      },
    });
    return this.serializeMobileUser(updated);
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.serializeUser(user);
  }

  private async createSession(user: User, rememberMe = false) {
    const tokens = await this.issueSession(user, rememberMe);
    return {
      ...tokens,
      user: this.serializeUser(user),
    };
  }

  private async createMobileSession(user: User, rememberMe = false) {
    const tokens = await this.issueSession(user, rememberMe);
    return {
      ...tokens,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
      user: this.serializeMobileUser(user),
    };
  }

  private async issueSession(user: User, rememberMe = false) {
    const expiresIn = Number(
      this.config.get<string>('JWT_ACCESS_TOKEN_TTL_SECONDS') ?? 900,
    );
    const payload: JwtUser = {
      sub: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn });
    const refreshToken = this.createRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: this.refreshTokenExpiry(rememberMe),
      },
    });

    return {
      accessToken,
      access_token: accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
    };
  }

  private serializeUser(user: User) {
    return {
      id: String(user.id),
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      businessId: user.businessId ? String(user.businessId) : null,
      onboardingCompleted: user.onboardingCompleted,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private serializeMobileUser(user: User) {
    const store = this.mobileStore(user);
    return {
      id: String(user.id),
      username: store.username ?? user.firstName ?? null,
      email: user.email,
      role: this.mobileRole(user.role),
      emailVerified: Boolean(store.emailVerified),
      profile: this.serializeMobileProfile(user),
      createdAt: user.createdAt,
    };
  }

  private serializeMobileProfile(user: User) {
    const store = this.mobileStore(user);
    const profile = this.record(store.profile);
    return {
      firstName: user.firstName,
      surname: user.lastName,
      dateOfBirth: user.birthDate?.toISOString().slice(0, 10) ?? null,
      gender: profile.gender ?? null,
      phone: user.phoneNumber,
      avatar: null,
      address: this.record(user.address),
      language: store.language ?? 'en',
      theme: store.theme ?? 'system',
    };
  }

  private mobileStore(user: User): Record<string, any> {
    return this.record(this.record(user.securityPreferences).mobile);
  }

  private withMobileStore(
    user: User,
    store: Record<string, any>,
  ): Prisma.InputJsonValue {
    return {
      ...this.record(user.securityPreferences),
      mobile: store,
    } as Prisma.InputJsonValue;
  }

  private mobileRole(role: UserRole) {
    if (role === UserRole.business) return 'shop_owner';
    if (role === UserRole.admin) return 'admin';
    return 'customer';
  }

  private record(value: unknown): Record<string, any> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, any>;
    }
    return {};
  }

  private createRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async verifyPassword(hash: string, password: string) {
    try {
      return await argon.verify(hash, password);
    } catch {
      return false;
    }
  }

  private refreshTokenExpiry(rememberMe: boolean) {
    const days = rememberMe
      ? Number(this.config.get<string>('JWT_REFRESH_TOKEN_REMEMBER_DAYS') ?? 30)
      : Number(this.config.get<string>('JWT_REFRESH_TOKEN_DAYS') ?? 7);
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + days);
    return expiresAt;
  }
}
