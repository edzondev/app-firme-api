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

  /**
   * GET /api/v1/contacts
   * Listar todos los contactos del usuario autenticado, ordenados por prioridad.
   */
  @Get()
  getContacts(@CurrentUser('firebaseUid') firebaseUid: string) {
    return this.contactsService.getContacts(firebaseUid);
  }

  /**
   * GET /api/v1/contacts/count
   * Contar contactos del usuario (incluye límite y plan).
   * NOTA: debe declararse antes de /:contactId para evitar conflictos de ruta.
   */
  @Get('count')
  countContacts(@CurrentUser('firebaseUid') firebaseUid: string) {
    return this.contactsService.countContacts(firebaseUid);
  }

  /**
   * POST /api/v1/contacts
   * Crear un contacto de emergencia.
   * Valida límite según plan (3 free / 5 premium).
   * Auto-vincula si el teléfono coincide con un usuario registrado.
   */
  @Post()
  createContact(
    @CurrentUser('firebaseUid') firebaseUid: string,
    @Body()
    body: {
      name: string;
      phone: string;
      relationship?: ContactInsert['relationship'];
      notifyMethod?: ContactInsert['notifyMethod'];
      notifyOnTripStart?: boolean;
    },
  ) {
    return this.contactsService.createContact(firebaseUid, body);
  }

  /**
   * POST /api/v1/contacts/reorder
   * Reordenar prioridades de contactos.
   * NOTA: debe declararse antes de /:contactId para evitar conflictos de ruta.
   */
  @Post('reorder')
  reorderContacts(
    @CurrentUser('firebaseUid') firebaseUid: string,
    @Body() body: { order: { contactId: string; priority: number }[] },
  ) {
    return this.contactsService.reorderContacts(firebaseUid, body.order);
  }

  /**
   * PATCH /api/v1/contacts/:contactId
   * Actualizar campos de un contacto (name, phone, relationship, priority, notifyMethod).
   */
  @Patch(':contactId')
  updateContact(
    @CurrentUser('firebaseUid') firebaseUid: string,
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
    return this.contactsService.updateContact(contactId, firebaseUid, body);
  }

  /**
   * DELETE /api/v1/contacts/:contactId
   * Eliminar un contacto. Verifica ownership.
   */
  @Delete(':contactId')
  deleteContact(
    @CurrentUser('firebaseUid') firebaseUid: string,
    @Param('contactId') contactId: string,
  ) {
    return this.contactsService.deleteContact(contactId, firebaseUid);
  }
}
