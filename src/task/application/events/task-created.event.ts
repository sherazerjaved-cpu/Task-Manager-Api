export class TaskCreatedEvent {
  constructor(
    public readonly taskId: string,
    public readonly ownerId: string,
    public readonly title: string,
  ) {}
}
