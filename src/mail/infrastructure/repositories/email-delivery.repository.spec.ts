import { Model, Types } from 'mongoose';

import { EmailDeliveryRepository } from './email-delivery.repository';
import { EmailDeliveryDocument } from 'src/mail/schema/email-delivery.schema';
import { EmailDeliveryStatus } from 'src/mail/domain/enums/email-delivery-status.enum';

describe('EmailDeliveryRepository', () => {
  let repository: EmailDeliveryRepository;

  let emailDeliveryModel: {
    create: jest.Mock;
    findOne: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };

  beforeEach(() => {
    emailDeliveryModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    repository = new EmailDeliveryRepository(
      emailDeliveryModel as unknown as Model<EmailDeliveryDocument>,
    );
  });

  describe('create', () => {
    it('should create an email delivery with default status and attempts', async () => {
      const createdDocument = {
        _id: new Types.ObjectId(),
        outboxEventId: new Types.ObjectId(),
        status: EmailDeliveryStatus.QUEUED,
        attempts: 0,
      };

      emailDeliveryModel.create.mockResolvedValue(createdDocument);

      const data = {
        outboxEventId: new Types.ObjectId(),
        to: 'user@example.com',
        emailType: 'EMAIL_VERIFICATION',
      };

      const result = await repository.create(data);

      expect(emailDeliveryModel.create).toHaveBeenCalledTimes(1);

      expect(emailDeliveryModel.create).toHaveBeenCalledWith({
        ...data,
        status: EmailDeliveryStatus.QUEUED,
        attempts: 0,
      });

      expect(result).toBe(createdDocument);
    });

    it('should preserve the provided status and attempts', async () => {
      const createdDocument = {
        _id: new Types.ObjectId(),
        outboxEventId: new Types.ObjectId(),
        status: EmailDeliveryStatus.SENDING,
        attempts: 2,
      };

      emailDeliveryModel.create.mockResolvedValue(createdDocument);

      const data = {
        outboxEventId: new Types.ObjectId(),
        to: 'user@example.com',
        emailType: 'EMAIL_VERIFICATION',
        status: EmailDeliveryStatus.SENDING,
        attempts: 2,
      };

      const result = await repository.create(data);

      expect(emailDeliveryModel.create).toHaveBeenCalledWith({
        ...data,
        status: EmailDeliveryStatus.SENDING,
        attempts: 2,
      });

      expect(result).toBe(createdDocument);
    });

    it('should use zero attempts when attempts is not provided', async () => {
      emailDeliveryModel.create.mockResolvedValue({});

      const data = {
        outboxEventId: new Types.ObjectId(),
        to: 'user@example.com',
        emailType: 'EMAIL_VERIFICATION',
        status: EmailDeliveryStatus.SENDING,
      };

      await repository.create(data);

      expect(emailDeliveryModel.create).toHaveBeenCalledWith({
        ...data,
        status: EmailDeliveryStatus.SENDING,
        attempts: 0,
      });
    });

    it('should propagate model create errors', async () => {
      const error = new Error('MongoDB create failed');

      emailDeliveryModel.create.mockRejectedValue(error);

      const data = {
        outboxEventId: new Types.ObjectId(),
        to: 'user@example.com',
        emailType: 'EMAIL_VERIFICATION',
      };

      await expect(repository.create(data)).rejects.toThrow(
        'MongoDB create failed',
      );
    });
  });

  describe('findByOutboxEventId', () => {
    it('should find an email delivery by outbox event ID', async () => {
      const outboxEventId = new Types.ObjectId();

      const document = {
        _id: new Types.ObjectId(),
        outboxEventId,
        status: EmailDeliveryStatus.QUEUED,
        attempts: 0,
      };

      const exec = jest.fn().mockResolvedValue(document);

      emailDeliveryModel.findOne.mockReturnValue({
        exec,
      });

      const result = await repository.findByOutboxEventId(outboxEventId);

      expect(emailDeliveryModel.findOne).toHaveBeenCalledTimes(1);

      expect(emailDeliveryModel.findOne).toHaveBeenCalledWith({
        outboxEventId,
      });

      expect(exec).toHaveBeenCalledTimes(1);

      expect(result).toBe(document);
    });

    it('should return null when the email delivery does not exist', async () => {
      const outboxEventId = new Types.ObjectId();

      const exec = jest.fn().mockResolvedValue(null);

      emailDeliveryModel.findOne.mockReturnValue({
        exec,
      });

      const result = await repository.findByOutboxEventId(outboxEventId);

      expect(result).toBeNull();

      expect(emailDeliveryModel.findOne).toHaveBeenCalledWith({
        outboxEventId,
      });
    });

    it('should propagate findOne errors', async () => {
      const outboxEventId = new Types.ObjectId();

      const exec = jest
        .fn()
        .mockRejectedValue(new Error('MongoDB query failed'));

      emailDeliveryModel.findOne.mockReturnValue({
        exec,
      });

      await expect(
        repository.findByOutboxEventId(outboxEventId),
      ).rejects.toThrow('MongoDB query failed');
    });
  });

  describe('update', () => {
    it('should update an email delivery and return the updated document', async () => {
      const id = new Types.ObjectId().toString();

      const updateData = {
        status: EmailDeliveryStatus.SENT,
        attempts: 1,
      };

      const updatedDocument = {
        _id: id,
        status: EmailDeliveryStatus.SENT,
        attempts: 1,
      };

      const exec = jest.fn().mockResolvedValue(updatedDocument);

      emailDeliveryModel.findByIdAndUpdate.mockReturnValue({
        exec,
      });

      const result = await repository.update(id, updateData);

      expect(emailDeliveryModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);

      expect(emailDeliveryModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        {
          $set: updateData,
        },
        {
          new: true,
        },
      );

      expect(exec).toHaveBeenCalledTimes(1);

      expect(result).toBe(updatedDocument);
    });

    it('should return null when the document does not exist', async () => {
      const id = new Types.ObjectId().toString();

      const exec = jest.fn().mockResolvedValue(null);

      emailDeliveryModel.findByIdAndUpdate.mockReturnValue({
        exec,
      });

      const result = await repository.update(id, {
        status: EmailDeliveryStatus.FAILED,
      });

      expect(result).toBeNull();

      expect(emailDeliveryModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        {
          $set: {
            status: EmailDeliveryStatus.FAILED,
          },
        },
        {
          new: true,
        },
      );
    });

    it('should use the new true option when updating', async () => {
      const id = new Types.ObjectId().toString();

      const exec = jest.fn().mockResolvedValue({});

      emailDeliveryModel.findByIdAndUpdate.mockReturnValue({
        exec,
      });

      await repository.update(id, {
        attempts: 3,
      });

      const [, , options] = emailDeliveryModel.findByIdAndUpdate.mock.calls[0];

      expect(options).toEqual({
        new: true,
      });
    });

    it('should propagate update errors', async () => {
      const id = new Types.ObjectId().toString();

      const exec = jest
        .fn()
        .mockRejectedValue(new Error('MongoDB update failed'));

      emailDeliveryModel.findByIdAndUpdate.mockReturnValue({
        exec,
      });

      await expect(
        repository.update(id, {
          status: EmailDeliveryStatus.FAILED,
        }),
      ).rejects.toThrow('MongoDB update failed');
    });
  });
});
