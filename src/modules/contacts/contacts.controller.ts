import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CurrentUser } from 'src/common/decorators/current-user/current-user.decorator';
import { emergencyContacts } from 'src/db/schema';

type ContactInsert = typeof emergencyContacts.$inferInsert;
type ContactSelect = typeof emergencyContacts.$inferSelect;

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  getContacts(@CurrentUser('userId') userId: string) {
    return this.contactsService.getContacts(userId);
  }

  @Get('count')
  countContacts(
    @CurrentUser('userId') userId: string,
    @CurrentUser('subscriptionStatus') subscriptionStatus: string | null,
  ) {
    return this.contactsService.countContacts(userId, subscriptionStatus);
  }

  @Post()
  createContact(
    @CurrentUser('userId') userId: string,
    @CurrentUser('subscriptionStatus') subscriptionStatus: string | null,
    @Body()
    body: {
      name: string;
      phone: string;
      relationship?: ContactInsert['relationship'];
      notifyMethod?: ContactInsert['notifyMethod'];
      notifyOnTripStart?: boolean;
    },
  ) {
    return this.contactsService.createContact(userId, subscriptionStatus, body);
  }

  @Post('reorder')
  reorderContacts(
    @CurrentUser('userId') userId: string,
    @Body() body: { order: { contactId: string; priority: number }[] },
  ) {
    return this.contactsService.reorderContacts(userId, body.order);
  }

  @Patch(':contactId')
  updateContact(
    @CurrentUser('userId') userId: string,
    @Param('contactId') contactId: string,
    @Body()
    body: Partial<
      Pick<
        ContactSelect,
        | 'name'
        | 'phone'
        | 'relationship'
        | 'priority'
        | 'notifyMethod'
        | 'notifyOnTripStart'
      >
    >,
  ) {
    return this.contactsService.updateContact(contactId, userId, body);
  }

  @Delete(':contactId')
  deleteContact(
    @CurrentUser('userId') userId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.contactsService.deleteContact(contactId, userId);
  }
}
