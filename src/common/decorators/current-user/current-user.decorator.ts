import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from 'src/common/types/auth-user';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;

    if (data) return user?.[data];
    return user;
  },
);
