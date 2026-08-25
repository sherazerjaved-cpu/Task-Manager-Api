import { Logger } from '@nestjs/common';

import { TaskCompletedEvent } from '../task-completed.event';
import { TaskCompletedHandler } from './task-completed.handler';

describe('TaskCompletedHandler', () => {
  let handler: TaskCompletedHandler;

  beforeEach(() => {
    handler = new TaskCompletedHandler();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log when a task is completed', () => {
    const event = new TaskCompletedEvent('task-123', 'owner-123');

    handler.handle(event);

    expect(Logger.prototype.log).toHaveBeenCalledWith(
      'Task completed successfully',
    );
  });
});
