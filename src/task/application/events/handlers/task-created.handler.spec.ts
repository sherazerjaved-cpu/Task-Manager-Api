import { Logger } from '@nestjs/common';

import { TaskCreatedEvent } from '../task-created.event';
import { TaskCreatedHandler } from './task-created.handler';

describe('TaskCreatedHandler', () => {
  let handler: TaskCreatedHandler;

  beforeEach(() => {
    handler = new TaskCreatedHandler();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log when a task is created', () => {
    const event = new TaskCreatedEvent('task-123', 'owner-123', 'Test task');

    handler.handle(event);

    expect(Logger.prototype.log).toHaveBeenCalledWith(
      'Task created successfully',
    );
  });
});
