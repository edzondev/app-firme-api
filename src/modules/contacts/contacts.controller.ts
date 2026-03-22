import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import * as schema from 'src/db/schema';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  create(@Body() createContact: typeof schema.emergencyContacts.$inferInsert) {
    return this.contactsService.createEmergencyContact(createContact);
  }

  @Get('count/:userId')
  getCount(@Param('userId') userId: string) {
    return this.contactsService.countEmergencyContacts(userId);
  }

  @Get()
  getEmergencyContacts() {
    return this.contactsService.getEmergencyContacts();
  }

  @Delete(':userId')
  remove(@Param('userId') userId: string) {
    return this.contactsService.deleteEmergencyContact(userId);
  }
}
