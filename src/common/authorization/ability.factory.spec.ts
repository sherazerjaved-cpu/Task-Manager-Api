import { subject } from '@casl/ability';
import { AbilityFactory } from './ability.factory';
import { Action } from './actions.enum';
import { Subject } from './subjects.enum';
import { WorkspaceRole } from 'src/workspace/domain/enums/workspace-role.enum';
import { Types } from 'mongoose';

describe('AbilityFactory', () => {
  let factory: AbilityFactory;

  const userId = new Types.ObjectId().toString();
  const anotherUserId = new Types.ObjectId().toString();

  beforeEach(() => {
    factory = new AbilityFactory();
  });

  describe('createForUser', () => {
    it('should allow creating a workspace', () => {
      const ability = factory.createForUser();

      expect(ability.can(Action.Create, Subject.Workspace)).toBe(true);
    });

    it('should not grant unrelated permissions', () => {
      const ability = factory.createForUser();

      expect(ability.can(Action.Read, Subject.Task)).toBe(false);

      expect(ability.can(Action.Manage, Subject.Task)).toBe(false);

      expect(ability.can(Action.Delete, Subject.Workspace)).toBe(false);
    });
  });

  describe('OWNER role', () => {
    let ability: ReturnType<AbilityFactory['createForRole']>;

    beforeEach(() => {
      ability = factory.createForRole(WorkspaceRole.OWNER, userId);
    });

    it('should manage workspaces', () => {
      expect(ability.can(Action.Manage, Subject.Workspace)).toBe(true);
    });

    it('should manage tasks', () => {
      expect(ability.can(Action.Manage, Subject.Task)).toBe(true);
    });

    it('should manage members', () => {
      expect(ability.can(Action.Manage, Subject.Member)).toBe(true);
    });

    it('should manage invitations', () => {
      expect(ability.can(Action.Manage, Subject.Invitation)).toBe(true);
    });

    it('should manage comments', () => {
      expect(ability.can(Action.Manage, Subject.Comment)).toBe(true);
    });

    it('should manage attachments', () => {
      expect(ability.can(Action.Manage, Subject.Attachment)).toBe(true);
    });

    it('should manage webhooks', () => {
      expect(ability.can(Action.Manage, Subject.Webhook)).toBe(true);
    });

    it('should manage billing', () => {
      expect(ability.can(Action.Manage, Subject.Billing)).toBe(true);
    });

    it('should read audit logs', () => {
      expect(ability.can(Action.Read, Subject.AuditLog)).toBe(true);
    });

    it('should manage exports', () => {
      expect(ability.can(Action.Manage, Subject.Export)).toBe(true);
    });

    it('should not delete audit logs', () => {
      expect(ability.can(Action.Delete, Subject.AuditLog)).toBe(false);
    });
  });

  describe('ADMIN role', () => {
    let ability: ReturnType<AbilityFactory['createForRole']>;

    beforeEach(() => {
      ability = factory.createForRole(WorkspaceRole.ADMIN, userId);
    });

    it('should read the workspace', () => {
      expect(ability.can(Action.Read, Subject.Workspace)).toBe(true);
    });

    it('should create tasks', () => {
      expect(ability.can(Action.Create, Subject.Task)).toBe(true);
    });

    it('should read tasks', () => {
      expect(ability.can(Action.Read, Subject.Task)).toBe(true);
    });

    it('should update tasks', () => {
      expect(ability.can(Action.Update, Subject.Task)).toBe(true);
    });

    it('should delete tasks', () => {
      expect(ability.can(Action.Delete, Subject.Task)).toBe(true);
    });

    it('should manage members', () => {
      expect(ability.can(Action.Manage, Subject.Member)).toBe(true);
    });

    it('should manage invitations', () => {
      expect(ability.can(Action.Manage, Subject.Invitation)).toBe(true);
    });

    it('should manage comments', () => {
      expect(ability.can(Action.Manage, Subject.Comment)).toBe(true);
    });

    it('should manage attachments', () => {
      expect(ability.can(Action.Manage, Subject.Attachment)).toBe(true);
    });

    it('should manage webhooks', () => {
      expect(ability.can(Action.Manage, Subject.Webhook)).toBe(true);
    });

    it('should read audit logs', () => {
      expect(ability.can(Action.Read, Subject.AuditLog)).toBe(true);
    });

    it('should create exports', () => {
      expect(ability.can(Action.Create, Subject.Export)).toBe(true);
    });

    it('should read exports', () => {
      expect(ability.can(Action.Read, Subject.Export)).toBe(true);
    });

    it('should not manage the workspace', () => {
      expect(ability.can(Action.Manage, Subject.Workspace)).toBe(true);
    });

    it('should not manage tasks', () => {
      expect(ability.can(Action.Manage, Subject.Task)).toBe(false);
    });
  });

  describe('MEMBER role', () => {
    let ability: ReturnType<AbilityFactory['createForRole']>;

    beforeEach(() => {
      ability = factory.createForRole(WorkspaceRole.MEMBER, userId);
    });

    it('should read the workspace', () => {
      expect(ability.can(Action.Read, Subject.Workspace)).toBe(true);
    });

    it('should create tasks', () => {
      expect(ability.can(Action.Create, Subject.Task)).toBe(true);
    });

    it('should read tasks', () => {
      expect(ability.can(Action.Read, Subject.Task)).toBe(true);
    });

    it('should read members', () => {
      expect(ability.can(Action.Read, Subject.Member)).toBe(true);
    });

    it('should update a task owned by the current user', () => {
      const task = {
        owner: new Types.ObjectId(userId),
        assignees: [],
      };

      expect(ability.can(Action.Update, subject(Subject.Task, task))).toBe(
        true,
      );
    });

    it('should update a task assigned to the current user', () => {
      const task = {
        owner: new Types.ObjectId(anotherUserId),
        assignees: [new Types.ObjectId(userId)],
      };

      expect(ability.can(Action.Update, subject(Subject.Task, task))).toBe(
        true,
      );
    });

    it('should not update a task owned by another user', () => {
      const task = {
        owner: new Types.ObjectId(anotherUserId),
        assignees: [],
      };

      expect(ability.can(Action.Update, subject(Subject.Task, task))).toBe(
        false,
      );
    });

    it('should not update a task assigned to another user', () => {
      const task = {
        owner: new Types.ObjectId(anotherUserId),
        assignees: [new Types.ObjectId(anotherUserId)],
      };

      expect(ability.can(Action.Update, subject(Subject.Task, task))).toBe(
        false,
      );
    });
    it('should read comments', () => {
      expect(ability.can(Action.Read, Subject.Comment)).toBe(true);
    });

    it('should create comments', () => {
      expect(ability.can(Action.Create, Subject.Comment)).toBe(true);
    });

    it('should read attachments', () => {
      expect(ability.can(Action.Read, Subject.Attachment)).toBe(true);
    });

    it('should create exports', () => {
      expect(ability.can(Action.Create, Subject.Export)).toBe(true);
    });

    it('should read exports', () => {
      expect(ability.can(Action.Read, Subject.Export)).toBe(true);
    });

    it('should not delete tasks', () => {
      expect(ability.can(Action.Delete, Subject.Task)).toBe(false);
    });

    it('should not manage members', () => {
      expect(ability.can(Action.Manage, Subject.Member)).toBe(false);
    });
  });

  describe('VIEWER role', () => {
    let ability: ReturnType<AbilityFactory['createForRole']>;

    beforeEach(() => {
      ability = factory.createForRole(WorkspaceRole.VIEWER, userId);
    });

    it('should read the workspace', () => {
      expect(ability.can(Action.Read, Subject.Workspace)).toBe(true);
    });

    it('should read members', () => {
      expect(ability.can(Action.Read, Subject.Member)).toBe(true);
    });

    it('should read tasks', () => {
      expect(ability.can(Action.Read, Subject.Task)).toBe(true);
    });

    it('should read comments', () => {
      expect(ability.can(Action.Read, Subject.Comment)).toBe(true);
    });

    it('should read attachments', () => {
      expect(ability.can(Action.Read, Subject.Attachment)).toBe(true);
    });

    it('should read exports', () => {
      expect(ability.can(Action.Read, Subject.Export)).toBe(true);
    });

    it('should not create tasks', () => {
      expect(ability.can(Action.Create, Subject.Task)).toBe(false);
    });

    it('should not update tasks', () => {
      expect(ability.can(Action.Update, Subject.Task)).toBe(false);
    });

    it('should not delete tasks', () => {
      expect(ability.can(Action.Delete, Subject.Task)).toBe(false);
    });

    it('should not manage members', () => {
      expect(ability.can(Action.Manage, Subject.Member)).toBe(false);
    });
  });

  describe('unsupported role', () => {
    it('should deny task management', () => {
      const ability = factory.createForRole(
        'unknown-role' as WorkspaceRole,
        userId,
      );

      expect(ability.can(Action.Manage, Subject.Task)).toBe(false);
    });
  });
});
