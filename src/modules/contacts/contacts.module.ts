import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';

@Module({
  imports: [],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}
