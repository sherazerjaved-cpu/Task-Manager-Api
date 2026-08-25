import { subject } from '@casl/ability';
import { updateTaskPolicy } from './update-task.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';

describe('updateTaskPolicy', () => {
  it('should return true when the ability allows updating the task', () => {
    const task = {
      _id: 'task-123',
      owner: 'user-123',
      assignees: ['user-456'],
    };

    const ability = {
      can: jest.fn().mockReturnValue(true),
    };

    const request = {
      task,
    };

    const result = updateTaskPolicy(ability as any, request);

    expect(result).toBe(true);

    expect(ability.can).toHaveBeenCalledWith(
      Action.Update,
      subject(Subject.Task, task),
    );
  });

  it('should return false when the ability denies updating the task', () => {
    const task = {
      _id: 'task-123',
      owner: 'user-456',
      assignees: ['user-789'],
    };

    const ability = {
      can: jest.fn().mockReturnValue(false),
    };

    const request = {
      task,
    };

    const result = updateTaskPolicy(ability as any, request);

    expect(result).toBe(false);

    expect(ability.can).toHaveBeenCalledWith(
      Action.Update,
      subject(Subject.Task, task),
    );
  });

  it('should return false when no task is loaded', () => {
    const ability = {
      can: jest.fn(),
    };

    const request = {};

    const result = updateTaskPolicy(ability as any, request);

    expect(result).toBe(false);

    expect(ability.can).not.toHaveBeenCalled();
  });
});
