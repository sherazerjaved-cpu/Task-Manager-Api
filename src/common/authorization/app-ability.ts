import { MongoAbility } from '@casl/ability';
import { Types } from 'mongoose';
import { Action } from './actions.enum';
import { Subject } from './subjects.enum';

export interface TaskAbilitySubject {
  owner: Types.ObjectId;
  assignees: Types.ObjectId[];
}

export type AppAbility = MongoAbility<[Action, Subject | TaskAbilitySubject]>;
