import { Injectable, Logger, Inject } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Types } from 'mongoose';

import { WebhookDocument } from '../schema/webhook.schema';

import { WEBHOOK_DELIVERY_REPOSITORY } from '../domain/constants/repository.tokens';
import type { IWebhookDeliveryRepository } from '../domain/repositories/webhook-delivery.repository.interface';

import { WebhookDeliveryStatus } from '../domain/enums/webhook-delivery-status.enum';

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    @Inject(WEBHOOK_DELIVERY_REPOSITORY)
    private readonly webhookDeliveryRepository: IWebhookDeliveryRepository,
  ) {}

  async deliver(
    webhook: WebhookDocument,
    outboxEventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    attempt: number,
  ): Promise<void> {
    const webhookId = webhook._id.toString();

    const existingSuccessfulDelivery =
      await this.webhookDeliveryRepository.findSuccessfulDelivery(
        new Types.ObjectId(webhookId),
        new Types.ObjectId(outboxEventId),
      );

    if (existingSuccessfulDelivery) {
      this.logger.log(
        `Webhook already delivered successfully: webhook=${webhookId}, event=${outboxEventId}`,
      );

      return;
    }

    const delivery = await this.webhookDeliveryRepository.create({
      webhookId: new Types.ObjectId(webhookId),
      outboxEventId: new Types.ObjectId(outboxEventId),
      eventType,
      attempt,
      status: WebhookDeliveryStatus.PENDING,
    });

    const startedAt = Date.now();

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 10_000);

    try {
      const body = JSON.stringify(payload);

      const signature = createHmac('sha256', webhook.secret)
        .update(body)
        .digest('hex');

      const response = await fetch(webhook.url, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': eventType,
          'X-Webhook-Delivery': outboxEventId,
        },

        body,
        signal: controller.signal,
      });

      const durationMs = Date.now() - startedAt;

      if (!response.ok) {
        const responseBody = await response.text();

        const errorMessage = `Webhook request failed with status ${response.status}`;

        await this.webhookDeliveryRepository.update(delivery._id.toString(), {
          status: WebhookDeliveryStatus.FAILED,
          responseStatus: response.status,
          error: responseBody
            ? `${errorMessage}: ${responseBody.slice(0, 500)}`
            : errorMessage,
          durationMs,
        });

        throw new Error(errorMessage);
      }

      await this.webhookDeliveryRepository.update(delivery._id.toString(), {
        status: WebhookDeliveryStatus.SUCCESS,
        responseStatus: response.status,
        durationMs,
        deliveredAt: new Date(),
      });

      this.logger.log(
        `Webhook delivered successfully: webhook=${webhookId}, event=${outboxEventId}`,
      );
    } catch (error) {
      const durationMs = Date.now() - startedAt;

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown webhook delivery error';

      await this.webhookDeliveryRepository.update(delivery._id.toString(), {
        status: WebhookDeliveryStatus.FAILED,
        error: errorMessage,
        durationMs,
      });

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
