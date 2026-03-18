
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Extrae el usuario del request (puesto ahí por el FirebaseAuthGuard)
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Si se pide un campo específico: @CurrentUser('firebaseUid')
    if (data) return user?.[data];

    // Si no, retorna todo el objeto user
    return user;
  },
);
