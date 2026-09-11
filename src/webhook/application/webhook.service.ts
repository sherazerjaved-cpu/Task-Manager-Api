import { Inject, Injectable, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { WEBHOOK_REPOSITORY } from '../domain/constants/repository.tokens';
import type { IWebhookRepository } from '../domain/repositories/webhook.repository.interface';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookDocument } from '../schema/webhook.schema';
import { FeatureFlagsService } from 'src/workspace/application/services/feature-flags.service';
import { WorkspaceFeatureFlag } from 'src/workspace/domain/enums/workspace-feature-flag.enum';

@Injectable()
export class WebhookService {
  constructor(
    @Inject(WEBHOOK_REPOSITORY)
    private readonly webhookRepository: IWebhookRepository,

    private readonly webhookDeliveryService: WebhookDeliveryService,

    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async create(
    workspaceId: string,
    url: string,
    events: string[],
  ): Promise<WebhookDocument> {
    const enabled = await this.featureFlagsService.isEnabled(
      workspaceId,
      WorkspaceFeatureFlag.WEBHOOKS,
    );

    if (!enabled) {
      throw new ForbiddenException('Webhooks are disabled for this workspace');
    }
    const secret = randomBytes(32).toString('hex');

    return this.webhookRepository.create({
      workspaceId: new Types.ObjectId(workspaceId),
      url,
      secret,
      events,
    });
  }

  async findByWorkspace(workspaceId: string): Promise<WebhookDocument[]> {
    const enabled = await this.featureFlagsService.isEnabled(
      workspaceId,
      WorkspaceFeatureFlag.WEBHOOKS,
    );

    if (!enabled) {
      throw new ForbiddenException('Webhooks are disabled for this workspace');
    }

    return this.webhookRepository.findByWorkspace(
      new Types.ObjectId(workspaceId),
    );
  }

  async deliverToWorkspace(
    workspaceId: string,
    outboxEventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    attempt: number,
  ): Promise<void> {
    const webhooks = await this.webhookRepository.findActiveByWorkspace(
      new Types.ObjectId(workspaceId),
      eventType,
    );

    const results = await Promise.allSettled(
      webhooks.map((webhook) =>
        this.webhookDeliveryService.deliver(
          webhook,
          outboxEventId,
          eventType,
          payload,
          attempt,
        ),
      ),
    );

    const failed = results.filter((result) => result.status === 'rejected');

    if (failed.length > 0) {
      throw new Error(`${failed.length} webhook delivery attempt(s) failed`);
    }
  }
}
