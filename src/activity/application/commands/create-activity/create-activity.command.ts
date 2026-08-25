import { CreateActivityDto } from '../../../DTO/create-activity.dto';

export class CreateActivityCommand {
  constructor(public readonly createActivityDto: CreateActivityDto) {}
}
