import { ReminderService } from './reminder.service';
import { TaskStatus } from 'src/task/Enums/task-status.enum';
import { WorkspaceFeatureFlag } from 'src/workspace/domain/enums/workspace-feature-flag.enum';
import { EmailDeliveryStatus } from 'src/mail/domain/enums/email-delivery-status.enum';

const mockCronJob = {
  start: jest.fn(),
};

jest.mock('cron', () => ({
  CronJob: jest.fn().mockImplementation(() => mockCronJob),
}));

describe('ReminderService', () => {
  let service: ReminderService;

  const taskModel = {
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  };

  const scheduleRegistry = {
    addCronJob: jest.fn(),
  };

  const outboxService = {
    create: jest.fn(),
  };

  const featureFlagsService = {
    isEnabled: jest.fn(),
  };

  const emailDeliveryRepository = {
    create: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ReminderService(
      taskModel as any,
      configService as any,
      scheduleRegistry as any,
      outboxService as any,
      featureFlagsService as any,
      emailDeliveryRepository as any,
    );
  });

  describe('onModuleInit', () => {
    it('should throw when REMINDER_CRON is not configured', () => {
      configService.get.mockReturnValue(undefined);

      expect(() => service.onModuleInit()).toThrow(
        'REMINDER_CRON is not defined',
      );

      expect(configService.get).toHaveBeenCalledWith('REMINDER_CRON');

      expect(scheduleRegistry.addCronJob).not.toHaveBeenCalled();

      expect(mockCronJob.start).not.toHaveBeenCalled();
    });

    it('should register and start the reminder cron job', () => {
      configService.get.mockReturnValue('*/5 * * * * *');

      service.onModuleInit();

      expect(configService.get).toHaveBeenCalledWith('REMINDER_CRON');

      expect(scheduleRegistry.addCronJob).toHaveBeenCalledTimes(1);

      expect(scheduleRegistry.addCronJob).toHaveBeenCalledWith(
        'task-reminders',
        mockCronJob,
      );

      expect(mockCronJob.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleCron', () => {
    const taskId = '507f1f77bcf86cd799439011';
    const workspaceId = '507f1f77bcf86cd799439012';

    const createTask = (overrides = {}) =>
      ({
        _id: taskId,
        workspace: workspaceId,
        title: 'Finish project',
        dueDate: new Date('2026-08-19T12:00:00.000Z'),
        priority: 'high',
        status: TaskStatus.Pending,
        isDeleted: false,
        reminderSent: false,
        owner: {
          email: 'user@example.com',
        },
        ...overrides,
      }) as any;

    const setupFind = (tasks: any[]) => {
      const populate = jest.fn().mockResolvedValue(tasks);

      taskModel.find.mockReturnValue({
        populate,
      });

      return populate;
    };

    it('should query tasks within the next 24 hours', async () => {
      const populate = setupFind([]);

      await service.handleCron();

      expect(taskModel.find).toHaveBeenCalledTimes(1);

      const query = taskModel.find.mock.calls[0][0];

      expect(query.dueDate).toEqual(
        expect.objectContaining({
          $gte: expect.any(Date),
          $lte: expect.any(Date),
        }),
      );

      expect(query.status).toEqual({
        $ne: TaskStatus.Done,
      });

      expect(query.isDeleted).toBe(false);

      expect(query.reminderSent).toEqual({
        $ne: true,
      });

      expect(populate).toHaveBeenCalledWith('owner');
    });

    it('should do nothing when there are no upcoming tasks', async () => {
      setupFind([]);

      await service.handleCron();

      expect(featureFlagsService.isEnabled).not.toHaveBeenCalled();

      expect(emailDeliveryRepository.create).not.toHaveBeenCalled();

      expect(outboxService.create).not.toHaveBeenCalled();
    });

    it('should skip a task when workspace is missing', async () => {
      setupFind([
        createTask({
          workspace: undefined,
        }),
      ]);

      await service.handleCron();

      expect(featureFlagsService.isEnabled).not.toHaveBeenCalled();

      expect(emailDeliveryRepository.create).not.toHaveBeenCalled();

      expect(outboxService.create).not.toHaveBeenCalled();
    });

    it('should skip a task when reminders are disabled', async () => {
      setupFind([createTask()]);

      featureFlagsService.isEnabled.mockResolvedValue(false);

      await service.handleCron();

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(
        workspaceId,
        WorkspaceFeatureFlag.REMINDERS,
      );

      expect(emailDeliveryRepository.create).not.toHaveBeenCalled();

      expect(outboxService.create).not.toHaveBeenCalled();

      expect(taskModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should skip a task when email notifications are disabled', async () => {
      setupFind([createTask()]);

      featureFlagsService.isEnabled
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await service.handleCron();

      expect(featureFlagsService.isEnabled).toHaveBeenNthCalledWith(
        1,
        workspaceId,
        WorkspaceFeatureFlag.REMINDERS,
      );

      expect(featureFlagsService.isEnabled).toHaveBeenNthCalledWith(
        2,
        workspaceId,
        WorkspaceFeatureFlag.EMAIL_NOTIFICATIONS,
      );

      expect(emailDeliveryRepository.create).not.toHaveBeenCalled();

      expect(outboxService.create).not.toHaveBeenCalled();
    });

    it('should skip a task when owner email is missing', async () => {
      setupFind([
        createTask({
          owner: {},
        }),
      ]);

      featureFlagsService.isEnabled
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await service.handleCron();

      expect(emailDeliveryRepository.create).not.toHaveBeenCalled();

      expect(outboxService.create).not.toHaveBeenCalled();

      expect(taskModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should create email delivery, outbox event, and mark reminder as sent', async () => {
      const task = createTask();

      setupFind([task]);

      featureFlagsService.isEnabled
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      emailDeliveryRepository.create.mockResolvedValue({
        _id: 'delivery-id',
      });

      outboxService.create.mockResolvedValue({
        _id: taskId,
      });

      taskModel.findByIdAndUpdate.mockResolvedValue(task);

      await service.handleCron();

      expect(emailDeliveryRepository.create).toHaveBeenCalledTimes(1);

      const deliveryData = emailDeliveryRepository.create.mock.calls[0][0];

      expect(deliveryData).toEqual({
        outboxEventId: expect.anything(),
        to: 'user@example.com',
        emailType: 'TASK_REMINDER',
        status: EmailDeliveryStatus.QUEUED,
      });

      expect(outboxService.create).toHaveBeenCalledTimes(1);

      expect(outboxService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          eventType: 'REMINDER_DUE',
          aggregateType: 'TASK',
          aggregateId: taskId,
          workspaceId,
          payload: {
            to: 'user@example.com',
            taskTitle: 'Finish project',
            dueDate: task.dueDate,
            priority: 'high',
          },
        }),
      );

      expect(taskModel.findByIdAndUpdate).toHaveBeenCalledWith(taskId, {
        reminderSent: true,
      });
    });

    it('should use the same outbox event ID for email delivery and outbox event', async () => {
      const task = createTask();

      setupFind([task]);

      featureFlagsService.isEnabled
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await service.handleCron();

      const deliveryData = emailDeliveryRepository.create.mock.calls[0][0];

      const outboxData = outboxService.create.mock.calls[0][0];

      expect(deliveryData.outboxEventId.toString()).toBe(outboxData.id);
    });

    it('should process multiple eligible tasks', async () => {
      const task1 = createTask({
        _id: '507f1f77bcf86cd799439011',
        title: 'Task One',
      });

      const task2 = createTask({
        _id: '507f1f77bcf86cd799439013',
        title: 'Task Two',
      });

      setupFind([task1, task2]);

      featureFlagsService.isEnabled.mockResolvedValue(true);

      await service.handleCron();

      expect(emailDeliveryRepository.create).toHaveBeenCalledTimes(2);

      expect(outboxService.create).toHaveBeenCalledTimes(2);

      expect(taskModel.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    });

    it('should continue processing other tasks when one task fails', async () => {
      const task1 = createTask({
        _id: '507f1f77bcf86cd799439011',
      });

      const task2 = createTask({
        _id: '507f1f77bcf86cd799439013',
      });

      setupFind([task1, task2]);

      featureFlagsService.isEnabled.mockResolvedValue(true);

      emailDeliveryRepository.create
        .mockRejectedValueOnce(new Error('Database unavailable'))
        .mockResolvedValueOnce({});

      await service.handleCron();

      expect(emailDeliveryRepository.create).toHaveBeenCalledTimes(2);

      expect(outboxService.create).toHaveBeenCalledTimes(1);

      expect(taskModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('should not mark reminder as sent when creating the outbox event fails', async () => {
      setupFind([createTask()]);

      featureFlagsService.isEnabled.mockResolvedValue(true);

      outboxService.create.mockRejectedValue(new Error('Outbox unavailable'));

      await service.handleCron();

      expect(emailDeliveryRepository.create).toHaveBeenCalledTimes(1);

      expect(outboxService.create).toHaveBeenCalledTimes(1);

      expect(taskModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should not process a task when reminders feature is disabled even if email notifications are enabled', async () => {
      setupFind([createTask()]);

      featureFlagsService.isEnabled.mockResolvedValueOnce(false);

      await service.handleCron();

      expect(featureFlagsService.isEnabled).toHaveBeenCalledTimes(1);

      expect(emailDeliveryRepository.create).not.toHaveBeenCalled();
    });
  });
});
