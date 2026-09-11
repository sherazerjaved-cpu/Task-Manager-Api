export class Workspace {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly owner: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
  ) {}
}
