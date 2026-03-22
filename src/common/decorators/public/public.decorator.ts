import { SetMetadata } from '@nestjs/common';

// Marca un endpoint como público (no requiere autenticación)
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
