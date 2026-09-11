import { WebhookController } from './webhook.controller';

describe('WebhookController', () => {
  let controller: WebhookController;
  let service: {
    create: jest.Mock;
    findByWorkspace: jest.Mock;
  };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findByWorkspace: jest.fn(),
    };

    controller = new WebhookController(service as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const workspaceId = 'workspace-123';

    const dto = {
      url: 'https://example.com/webhook',
      events: ['task.created', 'task.updated'],
    };

    const createdWebhook = {
      id: 'webhook-123',
      workspaceId,
      url: dto.url,
      events: dto.events,
      secret: 'super-secret',
      toObject: jest.fn().mockReturnValue({
        id: 'webhook-123',
        workspaceId,
        url: dto.url,
        events: dto.events,
        secret: 'super-secret',
      }),
    };

    it('should call WebhookService.create with workspace ID, URL, and events', async () => {
      service.create.mockResolvedValue(createdWebhook);

      await controller.create(workspaceId, dto as any);

      expect(service.create).toHaveBeenCalledTimes(1);
      expect(service.create).toHaveBeenCalledWith(
        workspaceId,
        dto.url,
        dto.events,
      );
    });

    it('should return the webhook without exposing its secret', async () => {
      service.create.mockResolvedValue(createdWebhook);

      const result = await controller.create(workspaceId, dto as any);

      expect(result).toEqual({
        id: 'webhook-123',
        workspaceId,
        url: dto.url,
        events: dto.events,
      });

      expect(result).not.toHaveProperty('secret');

      expect(createdWebhook.toObject).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from WebhookService.create', async () => {
      const error = new Error('Failed to create webhook');

      service.create.mockRejectedValue(error);

      await expect(controller.create(workspaceId, dto as any)).rejects.toThrow(
        error,
      );

      expect(service.create).toHaveBeenCalledWith(
        workspaceId,
        dto.url,
        dto.events,
      );
    });
  });

  describe('findAll', () => {
    const workspaceId = 'workspace-123';

    it('should call WebhookService.findByWorkspace with workspace ID', async () => {
      const webhooks = [
        {
          id: 'webhook-1',
          workspaceId,
          url: 'https://example.com/webhook-1',
          events: ['task.created'],
        },
      ];

      service.findByWorkspace.mockResolvedValue(webhooks);

      await controller.findAll(workspaceId);

      expect(service.findByWorkspace).toHaveBeenCalledTimes(1);
      expect(service.findByWorkspace).toHaveBeenCalledWith(workspaceId);
    });

    it('should return all webhooks from the service', async () => {
      const webhooks = [
        {
          id: 'webhook-1',
          workspaceId,
          url: 'https://example.com/webhook-1',
          events: ['task.created'],
        },
        {
          id: 'webhook-2',
          workspaceId,
          url: 'https://example.com/webhook-2',
          events: ['task.updated'],
        },
      ];

      service.findByWorkspace.mockResolvedValue(webhooks);

      const result = await controller.findAll(workspaceId);

      expect(result).toEqual(webhooks);
    });

    it('should return an empty array when the workspace has no webhooks', async () => {
      service.findByWorkspace.mockResolvedValue([]);

      const result = await controller.findAll(workspaceId);

      expect(result).toEqual([]);

      expect(service.findByWorkspace).toHaveBeenCalledWith(workspaceId);
    });

    it('should propagate errors from WebhookService.findByWorkspace', async () => {
      const error = new Error('Failed to find webhooks');

      service.findByWorkspace.mockRejectedValue(error);

      await expect(controller.findAll(workspaceId)).rejects.toThrow(error);

      expect(service.findByWorkspace).toHaveBeenCalledWith(workspaceId);
    });
  });
});
