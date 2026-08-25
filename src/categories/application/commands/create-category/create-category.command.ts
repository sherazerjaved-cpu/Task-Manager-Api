import { CreateCategryDto } from '../../../DTO/create_category.dto';

export class CreateCategoryCommand {
  constructor(
    public readonly createCategoryDto: CreateCategryDto,
    public readonly ownerId: string,
  ) {}
}
