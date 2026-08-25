import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';

import { WebhookService } from './webhook.service';
import { WEBHOOK_REPOSITORY } from '../domain/constants/repository.tokens';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { FeatureFlagsService } from 'src/workspace/application/services/feature-flags.service';
import { WorkspaceFeatureFlag } from 'src/workspace/domain/enums/workspace-feature-flag.enum';

describe('WebhookService', () => {
  let service: WebhookService;

  let webhookRepository: {
    create: jest.Mock;
    findByWorkspace: jest.Mock;
    findActiveByWorkspace: jest.Mock;
  };

  let webhookDeliveryService: {
    deliver: jest.Mock;
  };

  let featureFlagsService: {
    isEnabled: jest.Mock;
  };

  const workspaceId = new Types.ObjectId().toString();
  const outboxEventId = new Types.ObjectId().toString();

  const eventType = 'task.created';

  const payload = {
    taskId: 'task-123',
    title: 'Test task',
  };

  const events = ['task.created', 'task.updated'];

  const webhook = {
    _id: new Types.ObjectId(),
    workspaceId: new Types.ObjectId(workspaceId),
    url: 'https://example.com/webhook',
    secret: 'test-secret',
    events,
    active: true,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: WEBHOOK_REPOSITORY,
          useValue: {
            create: jest.fn(),
            findByWorkspace: jest.fn(),
            findActiveByWorkspace: jest.fn(),
          },
        },
        {
          provide: WebhookDeliveryService,
          useValue: {
            deliver: jest.fn(),
          },
        },
        {
          provide: FeatureFlagsService,
          useValue: {
            isEnabled: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);

    webhookRepository = module.get(WEBHOOK_REPOSITORY);

    webhookDeliveryService = module.get(WebhookDeliveryService);

    featureFlagsService = module.get(FeatureFlagsService);

    featureFlagsService.isEnabled.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a webhook when webhooks feature is enabled', async () => {
      webhookRepository.create.mockResolvedValue(webhook);

      const result = await service.create(workspaceId, webhook.url, events);

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(
        workspaceId,
        WorkspaceFeatureFlag.WEBHOOKS,
      );

      expect(webhookRepository.create).toHaveBeenCalledTimes(1);

      const createArg = webhookRepository.create.mock.calls[0][0];

      expect(createArg.workspaceId).toEqual(new Types.ObjectId(workspaceId));

      expect(createArg.url).toBe(webhook.url);
      expect(createArg.events).toEqual(events);

      expect(createArg.secret).toBeDefined();
      expect(typeof createArg.secret).toBe('string');
      expect(createArg.secret).toHaveLength(64);

      expect(result).toBe(webhook);
    });

    it('should generate a different secret for each webhook', async () => {
      webhookRepository.create
        .mockResolvedValueOnce(webhook)
        .mockResolvedValueOnce(webhook);

      await service.create(workspaceId, webhook.url, events);

      await service.create(workspaceId, webhook.url, events);

      const firstSecret = webhookRepository.create.mock.calls[0][0].secret;

      const secondSecret = webhookRepository.create.mock.calls[1][0].secret;

      expect(firstSecret).not.toBe(secondSecret);
    });

    it('should throw ForbiddenException when webhooks are disabled', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(false);

      await expect(
        service.create(workspaceId, webhook.url, events),
      ).rejects.toThrow(
        new ForbiddenException('Webhooks are disabled for this workspace'),
      );

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(
        workspaceId,
        WorkspaceFeatureFlag.WEBHOOKS,
      );

      expect(webhookRepository.create).not.toHaveBeenCalled();
    });

    it('should not create a webhook when the feature flag is disabled', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(false);

      await expect(
        service.create(workspaceId, webhook.url, events),
      ).rejects.toThrow(ForbiddenException);

      expect(webhookRepository.create).not.toHaveBeenCalled();
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Database failure');

      webhookRepository.create.mockRejectedValue(error);

      await expect(
        service.create(workspaceId, webhook.url, events),
      ).rejects.toThrow('Database failure');
    });
  });

  describe('findByWorkspace', () => {
    it('should return webhooks for the workspace when feature is enabled', async () => {
      const webhooks = [webhook];

      webhookRepository.findByWorkspace.mockResolvedValue(webhooks);

      const result = await service.findByWorkspace(workspaceId);

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(
        workspaceId,
        WorkspaceFeatureFlag.WEBHOOKS,
      );

      expect(webhookRepository.findByWorkspace).toHaveBeenCalledWith(
        new Types.ObjectId(workspaceId),
      );

      expect(result).toBe(webhooks);
    });

    it('should return an empty array when no webhooks exist', async () => {
      webhookRepository.findByWorkspace.mockResolvedValue([]);

      const result = await service.findByWorkspace(workspaceId);

      expect(result).toEqual([]);

      expect(webhookRepository.findByWorkspace).toHaveBeenCalledWith(
        new Types.ObjectId(workspaceId),
      );
    });

    it('should throw ForbiddenException when webhooks are disabled', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(false);

      await expect(service.findByWorkspace(workspaceId)).rejects.toThrow(
        new ForbiddenException('Webhooks are disabled for this workspace'),
      );

      expect(webhookRepository.findByWorkspace).not.toHaveBeenCalled();
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Database failure');

      webhookRepository.findByWorkspace.mockRejectedValue(error);

      await expect(service.findByWorkspace(workspaceId)).rejects.toThrow(
        'Database failure',
      );
    });
  });

  describe('deliverToWorkspace', () => {
    it('should deliver the event to all active webhooks', async () => {
      const webhook2 = {
        ...webhook,
        _id: new Types.ObjectId(),
        url: 'https://example.com/webhook-2',
      };

      webhookRepository.findActiveByWorkspace.mockResolvedValue([
        webhook,
        webhook2,
      ]);

      webhookDeliveryService.deliver.mockResolvedValue(undefined);

      await service.deliverToWorkspace(
        workspaceId,
        outboxEventId,
        eventType,
        payload,
        1,
      );

      expect(webhookRepository.findActiveByWorkspace).toHaveBeenCalledWith(
        new Types.ObjectId(workspaceId),
        eventType,
      );

      expect(webhookDeliveryService.deliver).toHaveBeenCalledTimes(2);

      expect(webhookDeliveryService.deliver).toHaveBeenNthCalledWith(
        1,
        webhook,
        outboxEventId,
        eventType,
        payload,
        1,
      );

      expect(webhookDeliveryService.deliver).toHaveBeenNthCalledWith(
        2,
        webhook2,
        outboxEventId,
        eventType,
        payload,
        1,
      );
    });

    it('should succeed when there are no active webhooks', async () => {
      webhookRepository.findActiveByWorkspace.mockResolvedValue([]);

      await expect(
        service.deliverToWorkspace(
          workspaceId,
          outboxEventId,
          eventType,
          payload,
          1,
        ),
      ).resolves.toBeUndefined();

      expect(webhookDeliveryService.deliver).not.toHaveBeenCalled();
    });

    it('should deliver to all webhooks even when one delivery fails', async () => {
      const webhook2 = {
        ...webhook,
        _id: new Types.ObjectId(),
        url: 'https://example.com/webhook-2',
      };

      const webhook3 = {
        ...webhook,
        _id: new Types.ObjectId(),
        url: 'https://example.com/webhook-3',
      };

      webhookRepository.findActiveByWorkspace.mockResolvedValue([
        webhook,
        webhook2,
        webhook3,
      ]);

      webhookDeliveryService.deliver
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Delivery failed'))
        .mockResolvedValueOnce(undefined);

      await expect(
        service.deliverToWorkspace(
          workspaceId,
          outboxEventId,
          eventType,
          payload,
          2,
        ),
      ).rejects.toThrow('1 webhook delivery attempt(s) failed');

      expect(webhookDeliveryService.deliver).toHaveBeenCalledTimes(3);
    });

    it('should report the correct number of failed deliveries', async () => {
      const webhook2 = {
        ...webhook,
        _id: new Types.ObjectId(),
      };

      const webhook3 = {
        ...webhook,
        _id: new Types.ObjectId(),
      };

      webhookRepository.findActiveByWorkspace.mockResolvedValue([
        webhook,
        webhook2,
        webhook3,
      ]);

      webhookDeliveryService.deliver
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce(undefined);

      await expect(
        service.deliverToWorkspace(
          workspaceId,
          outboxEventId,
          eventType,
          payload,
          1,
        ),
      ).rejects.toThrow('2 webhook delivery attempt(s) failed');
    });

    it('should pass the attempt number to every delivery', async () => {
      webhookRepository.findActiveByWorkspace.mockResolvedValue([webhook]);

      webhookDeliveryService.deliver.mockResolvedValue(undefined);

      await service.deliverToWorkspace(
        workspaceId,
        outboxEventId,
        eventType,
        payload,
        5,
      );

      expect(webhookDeliveryService.deliver).toHaveBeenCalledWith(
        webhook,
        outboxEventId,
        eventType,
        payload,
        5,
      );
    });

    it('should propagate repository errors from findActiveByWorkspace', async () => {
      const error = new Error('Database failure');

      webhookRepository.findActiveByWorkspace.mockRejectedValue(error);

      await expect(
        service.deliverToWorkspace(
          workspaceId,
          outboxEventId,
          eventType,
          payload,
          1,
        ),
      ).rejects.toThrow('Database failure');

      expect(webhookDeliveryService.deliver).not.toHaveBeenCalled();
    });
  });
});
