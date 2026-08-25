import { ProcessedEventRepository } from './processed-event.repository';

describe('ProcessedEventRepository', () => {
  let repository: ProcessedEventRepository;

  const processedEventModel = {
    exists: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    repository = new ProcessedEventRepository(processedEventModel as any);
  });

  describe('hasBeenProcessed', () => {
    it('should return true when the event exists', async () => {
      const eventId = 'event-123';

      processedEventModel.exists.mockResolvedValue({
        _id: 'some-id',
      });

      const result = await repository.hasBeenProcessed(eventId);

      expect(processedEventModel.exists).toHaveBeenCalledWith({
        eventId,
      });

      expect(result).toBe(true);
    });

    it('should return false when the event does not exist', async () => {
      const eventId = 'event-123';

      processedEventModel.exists.mockResolvedValue(null);

      const result = await repository.hasBeenProcessed(eventId);

      expect(processedEventModel.exists).toHaveBeenCalledWith({
        eventId,
      });

      expect(result).toBe(false);
    });

    it('should return false when exists returns undefined', async () => {
      const eventId = 'event-123';

      processedEventModel.exists.mockResolvedValue(undefined);

      const result = await repository.hasBeenProcessed(eventId);

      expect(result).toBe(false);
    });

    it('should propagate errors from MongoDB', async () => {
      const eventId = 'event-123';
      const error = new Error('MongoDB error');

      processedEventModel.exists.mockRejectedValue(error);

      await expect(repository.hasBeenProcessed(eventId)).rejects.toThrow(
        'MongoDB error',
      );

      expect(processedEventModel.exists).toHaveBeenCalledWith({
        eventId,
      });
    });
  });

  describe('markProcessed', () => {
    it('should create a processed event', async () => {
      const eventId = 'event-123';
      const eventType = 'TASK_CREATED';

      processedEventModel.create.mockResolvedValue({
        eventId,
        eventType,
      });

      await repository.markProcessed(eventId, eventType);

      expect(processedEventModel.create).toHaveBeenCalledWith({
        eventId,
        eventType,
      });
    });

    it('should resolve successfully when the event is created', async () => {
      processedEventModel.create.mockResolvedValue({
        eventId: 'event-123',
        eventType: 'TASK_CREATED',
      });

      await expect(
        repository.markProcessed('event-123', 'TASK_CREATED'),
      ).resolves.toBeUndefined();
    });

    it('should propagate errors when creation fails', async () => {
      const error = new Error('MongoDB insert failed');

      processedEventModel.create.mockRejectedValue(error);

      await expect(
        repository.markProcessed('event-123', 'TASK_CREATED'),
      ).rejects.toThrow('MongoDB insert failed');

      expect(processedEventModel.create).toHaveBeenCalledWith({
        eventId: 'event-123',
        eventType: 'TASK_CREATED',
      });
    });
  });
});
