import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { TaskCompletedEvent } from '../task-completed.event';

@EventsHandler(TaskCompletedEvent)
export class TaskCompletedHandler implements IEventHandler<TaskCompletedEvent> {
  private readonly logger = new Logger(TaskCompletedHandler.name);

  handle(event: TaskCompletedEvent): void {
    void event;
    this.logger.log(`Task completed successfully`);
  }
}
