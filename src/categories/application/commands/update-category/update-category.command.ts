import { UpdateCategoryDto } from '../../../DTO/update_category.dto';

export class UpdateCategoryCommand {
  constructor(
    public readonly id: string,
    public readonly updateCategoryDto: UpdateCategoryDto,
    public readonly ownerId: string,
    public readonly expectedVersion: number,
  ) {}
}
