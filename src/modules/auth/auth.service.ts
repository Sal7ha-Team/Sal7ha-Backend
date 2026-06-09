import {
  BadRequestException,
  ConflictException,
  Injectable,
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

    const ok = await argon.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.createSession(user, dto.rememberMe);
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

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.serializeUser(user);
  }

  private async createSession(user: User, rememberMe = false) {
    const expiresIn =
      this.config.get<number>('JWT_ACCESS_TOKEN_TTL_SECONDS') ?? 900;
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
      user: this.serializeUser(user),
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

  private createRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshTokenExpiry(rememberMe: boolean) {
    const days = rememberMe
      ? (this.config.get<number>('JWT_REFRESH_TOKEN_REMEMBER_DAYS') ?? 30)
      : (this.config.get<number>('JWT_REFRESH_TOKEN_DAYS') ?? 7);
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + days);
    return expiresAt;
  }
}
