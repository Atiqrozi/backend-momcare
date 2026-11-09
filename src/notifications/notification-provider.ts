import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { NotificationChannel } from './schemas/notification.schema';

export interface NotificationProvider {
  send(input: { channel: NotificationChannel; message: string; recipientPhone: string }): Promise<{
    providerMessageId: string;
  }>;
}

@Injectable()
export class MockNotificationProvider implements NotificationProvider {
  async send(): Promise<{ providerMessageId: string }> {
    return { providerMessageId: `mock-${randomUUID()}` };
  }
}

@Injectable()
export class WahaNotificationProvider implements NotificationProvider {
  constructor(private readonly config: ConfigService) {}

  async send(input: {
    channel: NotificationChannel;
    message: string;
    recipientPhone: string;
  }): Promise<{ providerMessageId: string }> {
    if (input.channel !== NotificationChannel.WHATSAPP) {
      throw new ServiceUnavailableException('WAHA hanya mendukung channel WhatsApp');
    }
    const baseUrl = this.config.get<string>('waha.baseUrl');
    if (!baseUrl) throw new ServiceUnavailableException('WAHA_BASE_URL belum dikonfigurasi');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = this.config.get<string>('waha.apiKey');
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/sendText`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session: this.config.get<string>('waha.session', 'default'),
        chatId: `${input.recipientPhone}@c.us`,
        text: input.message,
      }),
    });
    if (!response.ok) {
      const errorText = (await response.text()).slice(0, 500);
      throw new Error(`WAHA request failed (${response.status}): ${errorText}`);
    }
    const payload = (await response.json()) as { id?: string; key?: { id?: string } };
    const providerMessageId = payload.id ?? payload.key?.id;
    if (!providerMessageId) throw new Error('WAHA response tidak memiliki message id');
    return { providerMessageId };
  }
}
