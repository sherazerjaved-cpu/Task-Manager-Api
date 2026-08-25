export class GetTaskActivitiesQuery {
  constructor(
    public readonly taskId: string,
    public readonly userId: string,
    public readonly role: string,
  ) {}
}
