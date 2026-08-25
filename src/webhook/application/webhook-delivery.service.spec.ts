import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { createHmac } from 'crypto';

import { WebhookDeliveryService } from './webhook-delivery.service';
import { WEBHOOK_DELIVERY_REPOSITORY } from '../domain/constants/repository.tokens';
import { WebhookDeliveryStatus } from '../domain/enums/webhook-delivery-status.enum';

describe('WebhookDeliveryService', () => {
  let service: WebhookDeliveryService;

  let webhookDeliveryRepository: {
    findSuccessfulDelivery: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };

  const webhookId = new Types.ObjectId();
  const outboxEventId = new Types.ObjectId();
  const deliveryId = new Types.ObjectId();

  const webhook = {
    _id: webhookId,
    url: 'https://example.com/webhook',
    secret: 'test-secret',
  } as any;

  const eventType = 'task.created';

  const payload = {
    taskId: 'task-123',
    title: 'Test task',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDeliveryService,
        {
          provide: WEBHOOK_DELIVERY_REPOSITORY,
          useValue: {
            findSuccessfulDelivery: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookDeliveryService>(WebhookDeliveryService);

    webhookDeliveryRepository = module.get(WEBHOOK_DELIVERY_REPOSITORY);

    webhookDeliveryRepository.findSuccessfulDelivery.mockResolvedValue(null);

    webhookDeliveryRepository.create.mockResolvedValue({
      _id: deliveryId,
    });

    webhookDeliveryRepository.update.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deliver', () => {
    it('should skip delivery when a successful delivery already exists', async () => {
      const existingDelivery = {
        _id: new Types.ObjectId(),
        status: WebhookDeliveryStatus.SUCCESS,
      };

      webhookDeliveryRepository.findSuccessfulDelivery.mockResolvedValue(
        existingDelivery,
      );

      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      await service.deliver(
        webhook,
        outboxEventId.toString(),
        eventType,
        payload,
        1,
      );

      expect(
        webhookDeliveryRepository.findSuccessfulDelivery,
      ).toHaveBeenCalledWith(webhookId, outboxEventId);

      expect(webhookDeliveryRepository.create).not.toHaveBeenCalled();

      expect(fetchMock).not.toHaveBeenCalled();

      expect(webhookDeliveryRepository.update).not.toHaveBeenCalled();
    });

    it('should create a pending delivery before sending the webhook', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      await service.deliver(
        webhook,
        outboxEventId.toString(),
        eventType,
        payload,
        2,
      );

      expect(webhookDeliveryRepository.create).toHaveBeenCalledWith({
        webhookId,
        outboxEventId,
        eventType,
        attempt: 2,
        status: WebhookDeliveryStatus.PENDING,
      });
    });

    it('should send a POST request with the correct webhook headers and payload', async () => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      await service.deliver(
        webhook,
        outboxEventId.toString(),
        eventType,
        payload,
        1,
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, options] = fetchMock.mock.calls[0];

      expect(url).toBe(webhook.url);

      expect(options?.method).toBe('POST');

      expect(options?.headers).toMatchObject({
        'Content-Type': 'application/json',
        'X-Webhook-Event': eventType,
        'X-Webhook-Delivery': outboxEventId.toString(),
      });

      expect(options?.body).toBe(JSON.stringify(payload));

      expect(options?.signal).toBeInstanceOf(AbortSignal);
    });

    it('should generate the correct HMAC SHA-256 signature', async () => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      await service.deliver(
        webhook,
        outboxEventId.toString(),
        eventType,
        payload,
        1,
      );

      const expectedBody = JSON.stringify(payload);

      const expectedSignature = createHmac('sha256', webhook.secret)
        .update(expectedBody)
        .digest('hex');

      const [, options] = fetchMock.mock.calls[0];

      expect(options?.headers).toMatchObject({
        'X-Webhook-Signature': `sha256=${expectedSignature}`,
      });
    });

    it('should mark delivery as SUCCESS when the webhook responds successfully', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      await service.deliver(
        webhook,
        outboxEventId.toString(),
        eventType,
        payload,
        1,
      );

      expect(webhookDeliveryRepository.update).toHaveBeenCalledTimes(1);

      const [id, update] = webhookDeliveryRepository.update.mock.calls[0];

      expect(id).toBe(deliveryId.toString());

      expect(update.status).toBe(WebhookDeliveryStatus.SUCCESS);

      expect(update.responseStatus).toBe(200);

      expect(update.deliveredAt).toBeInstanceOf(Date);

      expect(typeof update.durationMs).toBe('number');
    });

    it('should mark delivery as FAILED and throw when webhook returns a non-2xx response', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal server error'),
      } as any);

      await expect(
        service.deliver(
          webhook,
          outboxEventId.toString(),
          eventType,
          payload,
          1,
        ),
      ).rejects.toThrow('Webhook request failed with status 500');

      expect(webhookDeliveryRepository.update).toHaveBeenCalled();

      /*
       * The service performs two FAILED updates here:
       *
       * 1. The non-2xx response block records responseStatus.
       * 2. The catch block records the thrown error.
       *
       * Therefore, do not assume the last update contains
       * responseStatus.
       */

      const failedUpdate = webhookDeliveryRepository.update.mock.calls.find(
        ([, update]) => update.responseStatus === 500,
      )?.[1];

      expect(failedUpdate).toBeDefined();

      expect(failedUpdate.status).toBe(WebhookDeliveryStatus.FAILED);

      expect(failedUpdate.responseStatus).toBe(500);

      expect(failedUpdate.error).toContain('Internal server error');

      expect(typeof failedUpdate.durationMs).toBe('number');
    });

    it('should mark delivery as FAILED without response body when webhook returns an error response', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue(''),
      } as any);

      await expect(
        service.deliver(
          webhook,
          outboxEventId.toString(),
          eventType,
          payload,
          1,
        ),
      ).rejects.toThrow('Webhook request failed with status 404');

      expect(webhookDeliveryRepository.update).toHaveBeenCalled();

      const failedUpdate = webhookDeliveryRepository.update.mock.calls.find(
        ([, update]) => update.responseStatus === 404,
      )?.[1];

      expect(failedUpdate).toBeDefined();

      expect(failedUpdate.status).toBe(WebhookDeliveryStatus.FAILED);

      expect(failedUpdate.responseStatus).toBe(404);

      expect(failedUpdate.error).toBe('Webhook request failed with status 404');

      expect(typeof failedUpdate.durationMs).toBe('number');
    });

    it('should mark delivery as FAILED and rethrow network errors', async () => {
      const error = new Error('Network failure');

      jest.spyOn(global, 'fetch').mockRejectedValue(error);

      await expect(
        service.deliver(
          webhook,
          outboxEventId.toString(),
          eventType,
          payload,
          1,
        ),
      ).rejects.toThrow('Network failure');

      expect(webhookDeliveryRepository.update).toHaveBeenCalled();

      const calls = webhookDeliveryRepository.update.mock.calls;

      const lastUpdate = calls[calls.length - 1][1];

      expect(lastUpdate.status).toBe(WebhookDeliveryStatus.FAILED);

      expect(lastUpdate.error).toBe('Network failure');

      expect(typeof lastUpdate.durationMs).toBe('number');
    });

    it('should truncate a large failed response body to 500 characters', async () => {
      const responseBody = 'x'.repeat(1000);

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(responseBody),
      } as any);

      await expect(
        service.deliver(
          webhook,
          outboxEventId.toString(),
          eventType,
          payload,
          1,
        ),
      ).rejects.toThrow('Webhook request failed with status 400');

      const calls = webhookDeliveryRepository.update.mock.calls;

      const failedUpdate = calls[0][1];

      expect(failedUpdate.error).toBe(
        `Webhook request failed with status 400: ${'x'.repeat(500)}`,
      );
    });

    it('should handle an unknown non-Error rejection', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue('something went wrong');

      await expect(
        service.deliver(
          webhook,
          outboxEventId.toString(),
          eventType,
          payload,
          1,
        ),
      ).rejects.toBe('something went wrong');

      const calls = webhookDeliveryRepository.update.mock.calls;

      const lastUpdate = calls[calls.length - 1][1];

      expect(lastUpdate.status).toBe(WebhookDeliveryStatus.FAILED);

      expect(lastUpdate.error).toBe('Unknown webhook delivery error');
    });
  });
});
