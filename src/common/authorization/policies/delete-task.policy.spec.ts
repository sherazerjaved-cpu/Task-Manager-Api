import { subject } from '@casl/ability';
import { deleteTaskPolicy } from './delete-task.policy';
import { Action } from '../actions.enum';
import { Subject } from '../subjects.enum';
import type { AppAbility } from '../app-ability';

describe('deleteTaskPolicy', () => {
  let ability: {
    can: jest.Mock;
  };

  beforeEach(() => {
    ability = {
      can: jest.fn(),
    };
  });

  it('should return false when no task is attached to the request', () => {
    const request = {};

    const result = deleteTaskPolicy(ability as unknown as AppAbility, request);

    expect(result).toBe(false);
    expect(ability.can).not.toHaveBeenCalled();
  });

  it('should return true when the ability allows deleting the task', () => {
    ability.can.mockReturnValue(true);

    const task = {
      _id: 'task-123',
      owner: 'user-123',
      assignees: [],
      workspaceId: 'workspace-123',
    };

    const request = {
      task,
    };

    const result = deleteTaskPolicy(ability as unknown as AppAbility, request);

    expect(result).toBe(true);

    expect(ability.can).toHaveBeenCalledTimes(1);
    expect(ability.can).toHaveBeenCalledWith(
      Action.Delete,
      subject(Subject.Task, task),
    );
  });

  it('should return false when the ability does not allow deleting the task', () => {
    ability.can.mockReturnValue(false);

    const task = {
      _id: 'task-123',
      owner: 'another-user',
      assignees: [],
      workspaceId: 'workspace-123',
    };

    const request = {
      task,
    };

    const result = deleteTaskPolicy(ability as unknown as AppAbility, request);

    expect(result).toBe(false);

    expect(ability.can).toHaveBeenCalledTimes(1);
    expect(ability.can).toHaveBeenCalledWith(
      Action.Delete,
      subject(Subject.Task, task),
    );
  });

  it('should pass the loaded task to CASL as a Task subject', () => {
    ability.can.mockReturnValue(true);

    const task = {
      _id: 'task-456',
      owner: 'user-456',
      assignees: ['user-789'],
      workspaceId: 'workspace-456',
      title: 'Important task',
    };

    const request = {
      task,
    };

    deleteTaskPolicy(ability as unknown as AppAbility, request);

    const [action, caslSubject] = ability.can.mock.calls[0];

    expect(action).toBe(Action.Delete);
    expect(caslSubject).toEqual(subject(Subject.Task, task));
  });
});
