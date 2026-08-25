export class TaskAssignedEvent {
  constructor(
    public readonly taskId: string,
    public readonly ownerId: string,
    public readonly assigneeIds: string[],
  ) {}
}
