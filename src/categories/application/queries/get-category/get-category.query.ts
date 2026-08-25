export class GetCategoryQuery {
  constructor(
    public readonly id: string,
    public readonly ownerId: string,
  ) {}
}
