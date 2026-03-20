import { Module } from '@nestjs/common';
import { SosService } from './sos.service';
import { SosController } from './sos.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  imports: [NotificationsModule, ContactsModule],
  controllers: [SosController],
  providers: [SosService],
  exports: [SosService],
})
export class SosModule {}
