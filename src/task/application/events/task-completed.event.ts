export class TaskCompletedEvent {
  constructor(
    public readonly taskId: string,
    public readonly ownerId: string,
  ) {}
}
