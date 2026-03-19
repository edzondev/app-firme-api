import {
  Inject,
  Injectable,
  InternalServerErrorException,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from 'src/db/drizzle.provider';
import { emergencyContacts } from 'src/db/schema';
import * as schema from 'src/db/schema';

@Injectable()
export class ContactsService {
  private readonly logger: Logger;

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {
    this.logger = new Logger(ContactsService.name);
  }

  async getEmergencyContacts(userId: string) {
    this.logger.debug(`Fetching emergency contacts for user ${userId}`);

    try {
      const results = await this.db
        .select()
        .from(emergencyContacts)
        .where(eq(emergencyContacts.userId, userId));

      this.logger.debug(
        `Fetched ${results.length} emergency contacts for user ${userId}`,
      );

      return results;
    } catch (error) {
      this.logger.error(
        `Error fetching emergency contacts for user ${userId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to fetch emergency contacts',
      );
    }
  }

  async createEmergencyContact(
    contact: typeof schema.emergencyContacts.$inferInsert,
  ) {
    this.logger.debug(`Creating emergency contact for user ${contact.userId}`);
    try {
      await this.db.insert(emergencyContacts).values(contact);

      this.logger.debug(`Emergency contact created for user ${contact.userId}`);

      return {
        message: 'Emergency contact created successfully',
        statusCode: HttpCode(HttpStatus.CREATED),
      };
    } catch (error) {
      this.logger.error(
        `Error creating emergency contact for user ${contact.userId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to create emergency contact',
      );
    }
  }

  async deleteEmergencyContact(contactId: string) {
    await this.db
      .delete(emergencyContacts)
      .where(eq(emergencyContacts.id, contactId));
  }

  async countEmergencyContacts(userId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(emergencyContacts)
      .where(eq(emergencyContacts.userId, userId));

    return result.length;
  }
}
