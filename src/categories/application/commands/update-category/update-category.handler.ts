import { ConflictException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { UpdateCategoryCommand } from './update-category.command';

import { CATEGORY_REPOSITORY } from '../../../domain/repositories/category.repository.interface';
import type { ICategoryRepository } from '../../../domain/repositories/category.repository.interface';

@CommandHandler(UpdateCategoryCommand)
export class UpdateCategoryHandler implements ICommandHandler<UpdateCategoryCommand> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
  ) {}

  async execute(command: UpdateCategoryCommand) {
    const { id, ownerId, updateCategoryDto, expectedVersion } = command;

    const category = await this.categoryRepository.findById(id, ownerId);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.__v !== expectedVersion) {
      throw new ConflictException(
        'Category has been modified. Please refresh and try again.',
      );
    }

    const updatedCategory = await this.categoryRepository.update(
      id,
      ownerId,
      updateCategoryDto,
      expectedVersion,
    );

    if (!updatedCategory) {
      throw new ConflictException(
        'Category has been modified. Please refresh and try again.',
      );
    }

    return updatedCategory;
  }
}
