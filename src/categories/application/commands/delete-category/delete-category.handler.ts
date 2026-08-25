import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteCategoryCommand } from './delete-category.command';

import { CATEGORY_REPOSITORY } from '../../../domain/repositories/category.repository.interface';
import type { ICategoryRepository } from '../../../domain/repositories/category.repository.interface';

@CommandHandler(DeleteCategoryCommand)
export class DeleteCategoryHandler implements ICommandHandler<DeleteCategoryCommand> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
  ) {}

  async execute(command: DeleteCategoryCommand) {
    const deletedCategory = await this.categoryRepository.delete(
      command.id,
      command.ownerId,
    );

    if (!deletedCategory) {
      throw new NotFoundException('Category not found');
    }

    return {
      message: 'Category Deleted Successfully',
    };
  }
}
