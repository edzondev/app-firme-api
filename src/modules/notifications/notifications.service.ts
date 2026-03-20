import { Injectable, Logger } from '@nestjs/common';

interface PushPayload {
  pushToken: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

interface SMSPayload {
  to: string; // +51987654321
  message: string;
}

interface PushResult {
  success: boolean;
  ticketId?: string;
  error?: string;
}

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // ============================================
  // EXPO PUSH NOTIFICATIONS (gratis)
  // No necesita librería — solo un fetch a la API de Expo
  // ============================================

  async sendPush(payload: PushPayload): Promise<PushResult> {
    try {
      // Validar formato del token
      if (!payload.pushToken?.startsWith('ExponentPushToken[')) {
        return { success: false, error: 'Token de push inválido' };
      }

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          to: payload.pushToken,
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          sound: 'default',
          priority: 'high', // SOS necesita máxima prioridad
          channelId: 'sos', // Canal de Android para SOS
        }),
      });

      const result = await response.json();

      if (result.data?.status === 'ok') {
        this.logger.log(`Push sent to ${payload.pushToken.slice(0, 30)}...`);
        return { success: true, ticketId: result.data.id };
      }

      this.logger.warn(`Push failed: ${JSON.stringify(result)}`);
      return {
        success: false,
        error: result.data?.message || 'Push failed',
      };
    } catch (error: any) {
      this.logger.error(`Push error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // SMS VIA TWILIO (premium)
  //
  // Por ahora usa fetch directo a la API REST de Twilio.
  // No necesitas instalar el SDK de Twilio — es solo un POST.
  // ============================================

  async sendSMS(payload: SMSPayload): Promise<SMSResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      this.logger.warn('Twilio not configured, skipping SMS');
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization:
              'Basic ' +
              Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          },
          body: new URLSearchParams({
            To: payload.to,
            From: fromNumber,
            Body: payload.message,
          }),
        },
      );

      const result = await response.json();

      if (result.sid) {
        this.logger.log(`SMS sent to ${payload.to}: ${result.sid}`);
        return { success: true, messageId: result.sid };
      }

      this.logger.warn(`SMS failed: ${JSON.stringify(result)}`);
      return { success: false, error: result.message || 'SMS failed' };
    } catch (error: any) {
      this.logger.error(`SMS error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // WHATSAPP VIA TWILIO (premium)
  //
  // Misma API que SMS pero con prefijo "whatsapp:" en From y To.
  // Requiere un Twilio WhatsApp Sender configurado.
  // ============================================

  async sendWhatsApp(payload: SMSPayload): Promise<SMSResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER; // whatsapp:+14155238886

    if (!accountSid || !authToken || !fromWhatsApp) {
      this.logger.warn('Twilio WhatsApp not configured, skipping');
      return { success: false, error: 'WhatsApp not configured' };
    }

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization:
              'Basic ' +
              Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          },
          body: new URLSearchParams({
            To: `whatsapp:${payload.to}`,
            From: fromWhatsApp,
            Body: payload.message,
          }),
        },
      );

      const result = await response.json();

      if (result.sid) {
        this.logger.log(`WhatsApp sent to ${payload.to}: ${result.sid}`);
        return { success: true, messageId: result.sid };
      }

      this.logger.warn(`WhatsApp failed: ${JSON.stringify(result)}`);
      return { success: false, error: result.message || 'WhatsApp failed' };
    } catch (error: any) {
      this.logger.error(`WhatsApp error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
