import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  sub: number;
  email: string;
  role: 'client' | 'business' | 'admin';
  businessId?: number | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtUser = request.user;
    return data ? user?.[data] : user;
  },
);
