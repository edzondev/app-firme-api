import { Global, Module } from '@nestjs/common';
import { FirebaseAdminProvider } from './firebase.provider';

@Global()
@Module({
  providers: [FirebaseAdminProvider],
  exports: [FirebaseAdminProvider],
})
export class FirebaseModule {}
