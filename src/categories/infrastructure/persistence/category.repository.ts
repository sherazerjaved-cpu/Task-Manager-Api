import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';

import { Category, CategoryDocument } from '../../Schema/categories.schema';
import { ICategoryRepository } from '../../domain/repositories/category.repository.interface';

@Injectable()
export class MongooseCategoryRepository implements ICategoryRepository {
  private readonly categoryCacheKeys = new Set<string>();

  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(category: any): Promise<Category> {
    const createdCategory = await this.categoryModel.create(category);

    await this.clearCache();

    return createdCategory;
  }

  async findAll(ownerId: string): Promise<Category[]> {
    const cacheKey = `categories:list:${ownerId}`;

    const cached = await this.cacheManager.get<Category[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const categories = await this.categoryModel.find({ owner: ownerId }).exec();

    await this.cacheManager.set(cacheKey, categories, 60 * 1000);
    this.categoryCacheKeys.add(cacheKey);

    return categories;
  }

  async findById(id: string, ownerId: string): Promise<Category | null> {
    const cacheKey = `category:${ownerId}:${id}`;

    const cached = await this.cacheManager.get<Category | null>(cacheKey);

    if (cached) {
      return cached;
    }

    const category = await this.categoryModel
      .findOne({
        _id: id,
        owner: ownerId,
      })
      .exec();

    if (category) {
      await this.cacheManager.set(cacheKey, category, 60 * 1000);
      this.categoryCacheKeys.add(cacheKey);
    }

    return category;
  }

  async findByIdForRole(
    id: string,
    ownerId: string,
    role: string,
  ): Promise<Category | null> {
    const cacheKey = `category:role:${role}:${ownerId}:${id}`;

    const cached = await this.cacheManager.get<Category | null>(cacheKey);

    if (cached) {
      return cached;
    }

    const filter: any = { _id: id };

    if (role !== 'admin') {
      filter.owner = ownerId;
    }

    const category = await this.categoryModel.findOne(filter).exec();

    if (category) {
      await this.cacheManager.set(cacheKey, category, 60 * 1000);
      this.categoryCacheKeys.add(cacheKey);
    }

    return category;
  }

  async update(
    id: string,
    ownerId: string,
    category: Partial<Category>,
    expectedVersion: number,
  ): Promise<Category | null> {
    const updatedCategory = await this.categoryModel
      .findOneAndUpdate(
        {
          _id: id,
          owner: ownerId,
          __v: expectedVersion,
        },
        {
          $set: category,
          $inc: { __v: 1 },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .exec();

    await this.clearCache();

    return updatedCategory;
  }

  async delete(id: string, ownerId: string): Promise<Category | null> {
    const deletedCategory = await this.categoryModel
      .findOneAndDelete({
        _id: id,
        owner: ownerId,
      })
      .exec();

    await this.clearCache();

    return deletedCategory;
  }

  async clearCache(): Promise<void> {
    for (const key of this.categoryCacheKeys) {
      await this.cacheManager.del(key);
    }

    this.categoryCacheKeys.clear();
  }
}
