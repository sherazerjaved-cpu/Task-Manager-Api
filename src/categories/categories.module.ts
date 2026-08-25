import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from './Schema/categories.schema';
import { CqrsModule } from '@nestjs/cqrs';
import { CATEGORY_REPOSITORY } from './domain/repositories/category.repository.interface';
import { MongooseCategoryRepository } from './infrastructure/persistence/category.repository';
import { CreateCategoryHandler } from './application/commands/create-category/create-category.handler';
import { GetCategoriesHandler } from './application/queries/get-categories/get-categories.handler';
import { GetCategoryHandler } from './application/queries/get-category/get-category.handler';
import { UpdateCategoryHandler } from './application/commands/update-category/update-category.handler';
import { DeleteCategoryHandler } from './application/commands/delete-category/delete-category.handler';

@Module({
  imports: [
    CqrsModule,
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [CategoriesController],
  providers: [
    {
      provide: CATEGORY_REPOSITORY,
      useClass: MongooseCategoryRepository,
    },
    CreateCategoryHandler,
    GetCategoriesHandler,
    GetCategoryHandler,
    UpdateCategoryHandler,
    DeleteCategoryHandler,
  ],
  exports: [CATEGORY_REPOSITORY],
})
export class CategoriesModule {}
