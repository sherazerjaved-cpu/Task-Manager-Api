import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

import { WebhookRepository } from './webhook.repository';

describe('WebhookRepository', () => {
  let repository: WebhookRepository;

  let webhookModel: {
    create: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
    findByIdAndDelete: jest.Mock;
  };

  let cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  const workspaceId = new Types.ObjectId();
  const webhookId = new Types.ObjectId();

  const webhook = {
    _id: webhookId,
    workspaceId,
    url: 'https://example.com/webhook',
    secret: 'test-secret',
    events: ['task.created'],
    active: true,
  };

  beforeEach(async () => {
    webhookModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookRepository,
        {
          provide: `WebhookModel`,
          useValue: webhookModel,
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    })
      .overrideProvider(`WebhookModel`)
      .useValue(webhookModel)
      .compile();

    repository = module.get<WebhookRepository>(WebhookRepository);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a webhook and invalidate workspace cache', async () => {
      webhookModel.create.mockResolvedValue(webhook);
      cacheManager.del.mockResolvedValue(undefined);

      const data = {
        workspaceId,
        url: 'https://example.com/webhook',
        secret: 'test-secret',
        events: ['task.created'],
      };

      const result = await repository.create(data);

      expect(webhookModel.create).toHaveBeenCalledWith(data);

      expect(cacheManager.del).toHaveBeenCalledWith(
        `webhooks:workspace:${workspaceId.toString()}`,
      );

      expect(result).toBe(webhook);
    });
  });

  describe('findByWorkspace', () => {
    it('should return cached webhooks when cache exists', async () => {
      const cachedWebhooks = [webhook];

      cacheManager.get.mockResolvedValue(cachedWebhooks);

      const result = await repository.findByWorkspace(workspaceId);

      expect(cacheManager.get).toHaveBeenCalledWith(
        `webhooks:workspace:${workspaceId.toString()}`,
      );

      expect(webhookModel.find).not.toHaveBeenCalled();

      expect(result).toBe(cachedWebhooks);
    });

    it('should query database when cache is empty', async () => {
      const webhooks = [webhook];

      cacheManager.get.mockResolvedValue(null);

      const exec = jest.fn().mockResolvedValue(webhooks);

      webhookModel.find.mockReturnValue({
        exec,
      });

      const result = await repository.findByWorkspace(workspaceId);

      expect(webhookModel.find).toHaveBeenCalledWith({
        workspaceId,
      });

      expect(exec).toHaveBeenCalled();

      expect(result).toBe(webhooks);
    });

    it('should cache database results', async () => {
      const webhooks = [webhook];

      cacheManager.get.mockResolvedValue(null);

      webhookModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(webhooks),
      });

      await repository.findByWorkspace(workspaceId);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `webhooks:workspace:${workspaceId.toString()}`,
        webhooks,
        60 * 1000,
      );
    });
  });

  describe('findActiveByWorkspace', () => {
    it('should return active webhooks subscribed to the event', async () => {
      const webhooks = [webhook];

      const exec = jest.fn().mockResolvedValue(webhooks);

      const select = jest.fn().mockReturnValue({
        exec,
      });

      webhookModel.find.mockReturnValue({
        select,
      });

      const result = await repository.findActiveByWorkspace(
        workspaceId,
        'task.created',
      );

      expect(webhookModel.find).toHaveBeenCalledWith({
        workspaceId,
        active: true,
        events: 'task.created',
      });

      expect(select).toHaveBeenCalledWith('+secret');

      expect(exec).toHaveBeenCalled();

      expect(result).toBe(webhooks);
    });
  });

  describe('findById', () => {
    it('should return the webhook by ID', async () => {
      const exec = jest.fn().mockResolvedValue(webhook);

      webhookModel.findById.mockReturnValue({
        exec,
      });

      const result = await repository.findById(webhookId.toString());

      expect(webhookModel.findById).toHaveBeenCalledWith(webhookId.toString());

      expect(exec).toHaveBeenCalled();

      expect(result).toBe(webhook);
    });

    it('should return null when webhook does not exist', async () => {
      webhookModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await repository.findById(webhookId.toString());

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete the webhook and invalidate workspace cache', async () => {
      webhookModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(webhook),
      });

      cacheManager.del.mockResolvedValue(undefined);

      const result = await repository.delete(webhookId.toString());

      expect(webhookModel.findByIdAndDelete).toHaveBeenCalledWith(
        webhookId.toString(),
      );

      expect(cacheManager.del).toHaveBeenCalledWith(
        `webhooks:workspace:${workspaceId.toString()}`,
      );

      expect(result).toBe(webhook);
    });

    it('should not invalidate cache when webhook does not exist', async () => {
      webhookModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await repository.delete(webhookId.toString());

      expect(result).toBeNull();

      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });
});
