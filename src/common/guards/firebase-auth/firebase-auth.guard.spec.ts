import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseAdminProvider } from 'src/firebase/firebase.provider';
import { DRIZZLE } from 'src/db/drizzle.provider';

describe('FirebaseAuthGuard', () => {
  let guard: FirebaseAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAuthGuard,
        Reflector,
        { provide: FirebaseAdminProvider, useValue: { verifyToken: jest.fn() } },
        { provide: DRIZZLE, useValue: { select: jest.fn() } },
      ],
    }).compile();

    guard = module.get<FirebaseAuthGuard>(FirebaseAuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });
});
