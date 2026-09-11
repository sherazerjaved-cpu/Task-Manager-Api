import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { WebhookDeliveryRepository } from './webhook-delivery.repository';
import { WebhookDelivery } from 'src/webhook/schema/webhook-delivery.schema';
import { WebhookDeliveryStatus } from 'src/webhook/domain/enums/webhook-delivery-status.enum';

describe('WebhookDeliveryRepository', () => {
  let repository: WebhookDeliveryRepository;

  let webhookDeliveryModel: {
    create: jest.Mock;
    findOne: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };

  const webhookId = new Types.ObjectId();
  const outboxEventId = new Types.ObjectId();
  const deliveryId = new Types.ObjectId();

  const delivery = {
    _id: deliveryId,
    webhookId,
    outboxEventId,
    eventType: 'task.created',
    attempt: 1,
    status: WebhookDeliveryStatus.PENDING,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDeliveryRepository,
        {
          provide: getModelToken(WebhookDelivery.name),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            findByIdAndUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<WebhookDeliveryRepository>(
      WebhookDeliveryRepository,
    );

    webhookDeliveryModel = module.get(getModelToken(WebhookDelivery.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create a webhook delivery with the provided data', async () => {
      webhookDeliveryModel.create.mockResolvedValue(delivery);

      const data = {
        webhookId,
        outboxEventId,
        eventType: 'task.created',
        attempt: 1,
        status: WebhookDeliveryStatus.PENDING,
      };

      const result = await repository.create(data);

      expect(webhookDeliveryModel.create).toHaveBeenCalledWith({
        ...data,
        status: WebhookDeliveryStatus.PENDING,
      });

      expect(result).toBe(delivery);
    });

    it('should default status to PENDING when status is not provided', async () => {
      webhookDeliveryModel.create.mockResolvedValue(delivery);

      const data = {
        webhookId,
        outboxEventId,
        eventType: 'task.created',
        attempt: 1,
      };

      await repository.create(data);

      expect(webhookDeliveryModel.create).toHaveBeenCalledWith({
        ...data,
        status: WebhookDeliveryStatus.PENDING,
      });
    });

    it('should preserve an explicitly provided status', async () => {
      const successfulDelivery = {
        ...delivery,
        status: WebhookDeliveryStatus.SUCCESS,
      };

      webhookDeliveryModel.create.mockResolvedValue(successfulDelivery);

      const data = {
        webhookId,
        outboxEventId,
        eventType: 'task.created',
        attempt: 1,
        status: WebhookDeliveryStatus.SUCCESS,
      };

      const result = await repository.create(data);

      expect(webhookDeliveryModel.create).toHaveBeenCalledWith({
        ...data,
        status: WebhookDeliveryStatus.SUCCESS,
      });

      expect(result).toBe(successfulDelivery);
    });

    it('should propagate model creation errors', async () => {
      const error = new Error('Database error');

      webhookDeliveryModel.create.mockRejectedValue(error);

      const data = {
        webhookId,
        outboxEventId,
        eventType: 'task.created',
        attempt: 1,
      };

      await expect(repository.create(data)).rejects.toThrow('Database error');
    });
  });

  describe('findSuccessfulDelivery', () => {
    it('should find a successful delivery by webhook and outbox event IDs', async () => {
      webhookDeliveryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(delivery),
      });

      const result = await repository.findSuccessfulDelivery(
        webhookId,
        outboxEventId,
      );

      expect(webhookDeliveryModel.findOne).toHaveBeenCalledWith({
        webhookId,
        outboxEventId,
        status: WebhookDeliveryStatus.SUCCESS,
      });

      expect(result).toBe(delivery);
    });

    it('should return null when no successful delivery exists', async () => {
      webhookDeliveryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await repository.findSuccessfulDelivery(
        webhookId,
        outboxEventId,
      );

      expect(result).toBeNull();
    });

    it('should only search for SUCCESS deliveries', async () => {
      webhookDeliveryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await repository.findSuccessfulDelivery(webhookId, outboxEventId);

      const query = webhookDeliveryModel.findOne.mock.calls[0][0];

      expect(query.status).toBe(WebhookDeliveryStatus.SUCCESS);
    });

    it('should propagate query errors', async () => {
      const error = new Error('Database query failed');

      webhookDeliveryModel.findOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(
        repository.findSuccessfulDelivery(webhookId, outboxEventId),
      ).rejects.toThrow('Database query failed');
    });
  });

  describe('update', () => {
    it('should update a webhook delivery by ID', async () => {
      const updatedDelivery = {
        ...delivery,
        status: WebhookDeliveryStatus.SUCCESS,
        responseStatus: 200,
      };

      webhookDeliveryModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedDelivery),
      });

      const updateData = {
        status: WebhookDeliveryStatus.SUCCESS,
        responseStatus: 200,
      };

      const result = await repository.update(deliveryId.toString(), updateData);

      expect(webhookDeliveryModel.findByIdAndUpdate).toHaveBeenCalledWith(
        deliveryId.toString(),
        {
          $set: updateData,
        },
        {
          new: true,
        },
      );

      expect(result).toBe(updatedDelivery);
    });

    it('should return null when the delivery does not exist', async () => {
      webhookDeliveryModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await repository.update(deliveryId.toString(), {
        status: WebhookDeliveryStatus.FAILED,
      });

      expect(result).toBeNull();
    });

    it('should update only the provided fields', async () => {
      webhookDeliveryModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(delivery),
      });

      const updateData = {
        error: 'Connection failed',
        durationMs: 1500,
      };

      await repository.update(deliveryId.toString(), updateData);

      expect(webhookDeliveryModel.findByIdAndUpdate).toHaveBeenCalledWith(
        deliveryId.toString(),
        {
          $set: updateData,
        },
        {
          new: true,
        },
      );
    });

    it('should request the updated document', async () => {
      webhookDeliveryModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(delivery),
      });

      await repository.update(deliveryId.toString(), {
        status: WebhookDeliveryStatus.SUCCESS,
      });

      const options = webhookDeliveryModel.findByIdAndUpdate.mock.calls[0][2];

      expect(options).toEqual({
        new: true,
      });
    });

    it('should propagate update errors', async () => {
      const error = new Error('Database update failed');

      webhookDeliveryModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(
        repository.update(deliveryId.toString(), {
          status: WebhookDeliveryStatus.FAILED,
        }),
      ).rejects.toThrow('Database update failed');
    });
  });
});
