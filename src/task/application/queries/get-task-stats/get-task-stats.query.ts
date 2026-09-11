export class GetTaskStatsQuery {
  constructor(
    public readonly userId: string,
    public readonly role: string,
  ) {}
}
