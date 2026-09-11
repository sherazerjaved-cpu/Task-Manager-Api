import { Types } from 'mongoose';
import { MongooseWorkspaceFeatureFlagsRepository } from './workspace-feature-flags.repository';
import { WorkspaceFeatureFlagsEntity } from '../../../domain/entities/workspace-feature-flags.entity';
import { WorkspaceFeatureFlag } from '../../../domain/enums/workspace-feature-flag.enum';

describe('MongooseWorkspaceFeatureFlagsRepository', () => {
  let repository: MongooseWorkspaceFeatureFlagsRepository;
  let model: any;

  const workspaceId = new Types.ObjectId().toString();

  const flags = {
    [WorkspaceFeatureFlag.WEBHOOKS]: true,
    [WorkspaceFeatureFlag.EXPORTS]: false,
    [WorkspaceFeatureFlag.REMINDERS]: true,
    [WorkspaceFeatureFlag.EMAIL_NOTIFICATIONS]: true,
    [WorkspaceFeatureFlag.ADVANCED_TASK_FILTERING]: false,
  };

  const entity = new WorkspaceFeatureFlagsEntity(workspaceId, flags);

  const document = {
    _id: new Types.ObjectId(),
    workspaceId: new Types.ObjectId(workspaceId),
    flags,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    model = {
      findOne: jest.fn(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    repository = new MongooseWorkspaceFeatureFlagsRepository(model);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByWorkspaceId', () => {
    it('should find feature flags by workspace ID', async () => {
      const lean = jest.fn().mockReturnThis();
      const exec = jest.fn().mockResolvedValue(document);

      model.findOne.mockReturnValue({
        lean,
        exec,
      });

      const result = await repository.findByWorkspaceId(workspaceId);

      expect(model.findOne).toHaveBeenCalledWith({
        workspaceId: new Types.ObjectId(workspaceId),
      });

      expect(lean).toHaveBeenCalled();
      expect(exec).toHaveBeenCalled();

      expect(result).toBeInstanceOf(WorkspaceFeatureFlagsEntity);
      expect(result?.workspaceId).toBe(workspaceId);
      expect(result?.flags).toEqual(flags);
    });

    it('should return null when feature flags do not exist', async () => {
      const lean = jest.fn().mockReturnThis();
      const exec = jest.fn().mockResolvedValue(null);

      model.findOne.mockReturnValue({
        lean,
        exec,
      });

      const result = await repository.findByWorkspaceId(workspaceId);

      expect(result).toBeNull();
    });

    it('should propagate errors from model.findOne', async () => {
      const error = new Error('Database error');

      model.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(repository.findByWorkspaceId(workspaceId)).rejects.toThrow(
        error,
      );
    });
  });

  describe('create', () => {
    it('should create feature flags with the correct arguments', async () => {
      model.create.mockResolvedValue(document);

      const result = await repository.create(entity);

      expect(model.create).toHaveBeenCalledWith({
        workspaceId: new Types.ObjectId(workspaceId),
        flags,
      });

      expect(result).toBeInstanceOf(WorkspaceFeatureFlagsEntity);
      expect(result.workspaceId).toBe(workspaceId);
      expect(result.flags).toEqual(flags);
    });

    it('should propagate errors from model.create', async () => {
      const error = new Error('Database error');

      model.create.mockRejectedValue(error);

      await expect(repository.create(entity)).rejects.toThrow(error);
    });
  });

  describe('update', () => {
    it('should update the provided feature flags', async () => {
      const updatedFlags = {
        [WorkspaceFeatureFlag.WEBHOOKS]: false,
        [WorkspaceFeatureFlag.EXPORTS]: true,
      };

      const updatedDocument = {
        ...document,
        flags: {
          ...flags,
          ...updatedFlags,
        },
      };

      const lean = jest.fn().mockReturnThis();
      const exec = jest.fn().mockResolvedValue(updatedDocument);

      model.findOneAndUpdate.mockReturnValue({
        lean,
        exec,
      });

      const result = await repository.update(workspaceId, updatedFlags);

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        {
          workspaceId: new Types.ObjectId(workspaceId),
        },
        {
          $set: {
            [`flags.${WorkspaceFeatureFlag.WEBHOOKS}`]: false,
            [`flags.${WorkspaceFeatureFlag.EXPORTS}`]: true,
          },
        },
        {
          new: true,
          upsert: false,
        },
      );

      expect(lean).toHaveBeenCalled();
      expect(exec).toHaveBeenCalled();

      expect(result).toBeInstanceOf(WorkspaceFeatureFlagsEntity);
      expect(result.workspaceId).toBe(workspaceId);
      expect(result.flags).toEqual(updatedDocument.flags);
    });

    it('should correctly update a single flag', async () => {
      const updatedDocument = {
        ...document,
        flags: {
          ...flags,
          [WorkspaceFeatureFlag.WEBHOOKS]: false,
        },
      };

      model.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(updatedDocument),
      });

      const result = await repository.update(workspaceId, {
        [WorkspaceFeatureFlag.WEBHOOKS]: false,
      });

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        {
          workspaceId: new Types.ObjectId(workspaceId),
        },
        {
          $set: {
            [`flags.${WorkspaceFeatureFlag.WEBHOOKS}`]: false,
          },
        },
        {
          new: true,
          upsert: false,
        },
      );

      expect(result.flags).toEqual(updatedDocument.flags);
    });

    it('should throw an error when the feature flags do not exist', async () => {
      model.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        repository.update(workspaceId, {
          [WorkspaceFeatureFlag.WEBHOOKS]: true,
        }),
      ).rejects.toThrow(`Feature flags not found for workspace ${workspaceId}`);
    });

    it('should propagate errors from model.findOneAndUpdate', async () => {
      const error = new Error('Database error');

      model.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(error),
      });

      await expect(
        repository.update(workspaceId, {
          [WorkspaceFeatureFlag.WEBHOOKS]: true,
        }),
      ).rejects.toThrow(error);
    });
  });

  describe('entity mapping', () => {
    it('should map a MongoDB document to WorkspaceFeatureFlagsEntity', async () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const updatedAt = new Date('2026-01-02T00:00:00.000Z');

      const mongoDocument = {
        workspaceId: new Types.ObjectId(workspaceId),
        flags,
        createdAt,
        updatedAt,
      };

      model.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mongoDocument),
      });

      const result = await repository.findByWorkspaceId(workspaceId);

      expect(result).toBeInstanceOf(WorkspaceFeatureFlagsEntity);

      expect(result?.workspaceId).toBe(workspaceId);
      expect(result?.flags).toEqual(flags);
      expect(result?.createdAt).toEqual(createdAt);
      expect(result?.updatedAt).toEqual(updatedAt);
    });

    it('should map a Map of flags to a plain object', async () => {
      const flagMap = new Map<WorkspaceFeatureFlag, boolean>([
        [WorkspaceFeatureFlag.WEBHOOKS, true],
        [WorkspaceFeatureFlag.EXPORTS, false],
      ]);

      const mongoDocument = {
        workspaceId: new Types.ObjectId(workspaceId),
        flags: flagMap,
      };

      model.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mongoDocument),
      });

      const result = await repository.findByWorkspaceId(workspaceId);

      expect(result?.flags).toEqual({
        [WorkspaceFeatureFlag.WEBHOOKS]: true,
        [WorkspaceFeatureFlag.EXPORTS]: false,
      });
    });

    it('should use an empty object when flags are missing', async () => {
      const mongoDocument = {
        workspaceId: new Types.ObjectId(workspaceId),
        flags: undefined,
      };

      model.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mongoDocument),
      });

      const result = await repository.findByWorkspaceId(workspaceId);

      expect(result?.flags).toEqual({});
    });
  });
});
