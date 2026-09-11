import { Types } from 'mongoose';

import { CreateActivityDto } from './create-activity.dto';
import { ActivityAction } from '../enums/activity-action.enum';

describe('CreateActivityDto', () => {
  it('should be defined', () => {
    expect(CreateActivityDto).toBeDefined();
  });

  it('should create a DTO with required properties', () => {
    const taskId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    const dto = new CreateActivityDto();

    dto.task = taskId;
    dto.user = userId;
    dto.action = ActivityAction.CREATED;

    expect(dto).toBeInstanceOf(CreateActivityDto);
    expect(dto.task).toBe(taskId);
    expect(dto.user).toBe(userId);
    expect(dto.action).toBe(ActivityAction.CREATED);
  });

  it('should create a DTO with optional description and changes', () => {
    const taskId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    const changes = {
      priority: {
        old: 'medium',
        new: 'high',
      },
    };

    const dto = new CreateActivityDto();

    dto.task = taskId;
    dto.user = userId;
    dto.action = ActivityAction.UPDATED;
    dto.description = 'Task priority changed.';
    dto.changes = changes;

    expect(dto.description).toBe('Task priority changed.');
    expect(dto.changes).toEqual(changes);
  });

  it('should allow optional properties to be omitted', () => {
    const dto = new CreateActivityDto();

    dto.task = new Types.ObjectId();
    dto.user = new Types.ObjectId();
    dto.action = ActivityAction.DELETED;

    expect(dto.description).toBeUndefined();
    expect(dto.changes).toBeUndefined();
  });
});
