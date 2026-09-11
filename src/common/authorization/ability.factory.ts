import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { Action } from './actions.enum';
import { Subject } from './subjects.enum';
import { AppAbility } from './app-ability';
import { WorkspaceRole } from 'src/workspace/domain/enums/workspace-role.enum';
import { Types } from 'mongoose';

@Injectable()
export class AbilityFactory {
  createForUser(): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    can(Action.Create, Subject.Workspace);

    return build();
  }

  createForRole(role: WorkspaceRole, userId: string): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    switch (role) {
      case WorkspaceRole.OWNER:
        can(Action.Manage, Subject.Workspace);
        can(Action.Manage, Subject.Task);
        can(Action.Manage, Subject.Member);
        can(Action.Manage, Subject.Invitation);
        can(Action.Manage, Subject.Comment);
        can(Action.Manage, Subject.Attachment);
        can(Action.Manage, Subject.Webhook);
        can(Action.Manage, Subject.Billing);
        can(Action.Read, Subject.AuditLog);
        can(Action.Manage, Subject.Export);
        break;

      case WorkspaceRole.ADMIN:
        can(Action.Read, Subject.Workspace);
        can(Action.Manage, Subject.Workspace);
        can(Action.Create, Subject.Task);
        can(Action.Read, Subject.Task);
        can(Action.Update, Subject.Task);
        can(Action.Delete, Subject.Task);
        can(Action.Manage, Subject.Member);
        can(Action.Manage, Subject.Invitation);
        can(Action.Manage, Subject.Comment);
        can(Action.Manage, Subject.Attachment);
        can(Action.Manage, Subject.Webhook);
        can(Action.Read, Subject.AuditLog);
        can(Action.Create, Subject.Export);
        can(Action.Read, Subject.Export);
        break;

      case WorkspaceRole.MEMBER:
        can(Action.Read, Subject.Workspace);
        can(Action.Create, Subject.Task);
        can(Action.Read, Subject.Task);
        can(Action.Read, Subject.Member);

        can(Action.Update, Subject.Task, {
          owner: new Types.ObjectId(userId),
        });

        can(Action.Update, Subject.Task, {
          assignees: {
            $in: [new Types.ObjectId(userId)],
          },
        });

        can(Action.Read, Subject.Comment);
        can(Action.Create, Subject.Comment);
        can(Action.Read, Subject.Attachment);
        can(Action.Create, Subject.Export);
        can(Action.Read, Subject.Export);

        break;

      case WorkspaceRole.VIEWER:
        can(Action.Read, Subject.Workspace);
        can(Action.Read, Subject.Member);
        can(Action.Read, Subject.Task);
        can(Action.Read, Subject.Comment);
        can(Action.Read, Subject.Attachment);
        can(Action.Read, Subject.Export);
        break;

      default:
        cannot(Action.Manage, Subject.Task);
        break;
    }

    return build();
  }
}
