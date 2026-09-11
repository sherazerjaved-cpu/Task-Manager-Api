import { TaskAssignedEvent } from './task-assigned.event';

describe('TaskAssignedEvent', () => {
  it('should create an event with task, owner, and assignee IDs', () => {
    const event = new TaskAssignedEvent('task-123', 'owner-123', [
      'assignee-1',
      'assignee-2',
    ]);

    expect(event.taskId).toBe('task-123');
    expect(event.ownerId).toBe('owner-123');
    expect(event.assigneeIds).toEqual(['assignee-1', 'assignee-2']);
  });
});
