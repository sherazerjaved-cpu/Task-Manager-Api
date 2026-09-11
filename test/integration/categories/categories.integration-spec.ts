import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Connection, Model } from 'mongoose';
import { shutdownIntegrationApp } from '../helpers/shutdown-helper';
import { createIntegrationApp } from '../setup/test-app.factory';
import { clearDatabase } from '../setup/database';

import { clearRedis } from '../setup/redis';

// ============================================================
// COMMANDS
// ============================================================

import { CreateCategoryCommand } from '../../../src/categories/application/commands/create-category/create-category.command';
import { UpdateCategoryCommand } from '../../../src/categories/application/commands/update-category/update-category.command';
import { DeleteCategoryCommand } from '../../../src/categories/application/commands/delete-category/delete-category.command';

// ============================================================
// QUERIES
// ============================================================

import { GetCategoriesQuery } from '../../../src/categories/application/queries/get-categories/get-categories.query';
import { GetCategoryQuery } from '../../../src/categories/application/queries/get-category/get-category.query';

// ============================================================
// SCHEMA
// ============================================================

import {
  Category,
  CategoryDocument,
} from '../../../src/categories/Schema/categories.schema';

// ============================================================
// TEST
// ============================================================

describe('Categories Handlers Integration', () => {
  let app: INestApplication;
  let mongoConnection: Connection;

  let commandBus: CommandBus;
  let queryBus: QueryBus;

  let categoryModel: Model<CategoryDocument>;

  let ownerId: string;
  let secondUserId: string;

  // ============================================================
  // SETUP
  // ============================================================

  beforeAll(async () => {
    app = await createIntegrationApp();

    mongoConnection = app.get<Connection>(getConnectionToken());

    commandBus = app.get(CommandBus);
    queryBus = app.get(QueryBus);

    categoryModel = app.get<Model<CategoryDocument>>(
      getModelToken(Category.name),
    );
  }, 30000);

  beforeEach(async () => {
    await clearDatabase(mongoConnection);
    await clearRedis();

    await seedUsers();
  }, 30000);

  afterAll(async () => {
    await shutdownIntegrationApp(app, mongoConnection);
  }, 30000);

  // ============================================================
  // TEST DATA
  // ============================================================

  async function seedUsers() {
    const users = await categoryModel.db.collection('users').insertMany([
      {
        email: `category-owner-${Date.now()}@example.com`,
        password: 'Password123',
        emailVerified: true,
        role: 'user',
      },
      {
        email: `category-second-${Date.now()}@example.com`,
        password: 'Password123',
        emailVerified: true,
        role: 'user',
      },
    ]);

    const ids = Object.values(users.insertedIds);

    ownerId = ids[0].toString();
    secondUserId = ids[1].toString();
  }

  async function createCategory(
    owner: string = ownerId,
    overrides: Record<string, unknown> = {},
  ): Promise<CategoryDocument> {
    return categoryModel.create({
      name: `Integration Category ${Date.now()}-${Math.random()}`,
      owner,
      ...overrides,
    });
  }

  // ============================================================
  // CREATE CATEGORY
  // ============================================================

  describe('CreateCategoryHandler', () => {
    it('should create and persist a category', async () => {
      const result = await commandBus.execute(
        new CreateCategoryCommand(
          {
            name: 'Work',
            color: '#3498db',
          },
          ownerId,
        ),
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('Work');
      expect(result.color).toBe('#3498db');

      expect(result.owner.toString()).toBe(ownerId);

      const category = await categoryModel.findById(result._id).lean();

      expect(category).toBeDefined();
      expect(category!.name).toBe('Work');
      expect(category!.color).toBe('#3498db');
      expect(category!.owner.toString()).toBe(ownerId);
    });

    it('should reject duplicate category names for the same owner', async () => {
      await commandBus.execute(
        new CreateCategoryCommand(
          {
            name: 'Work',
          },
          ownerId,
        ),
      );

      await expect(
        commandBus.execute(
          new CreateCategoryCommand(
            {
              name: 'Work',
            },
            ownerId,
          ),
        ),
      ).rejects.toThrow();
    });

    it('should allow the same category name for different owners', async () => {
      await commandBus.execute(
        new CreateCategoryCommand(
          {
            name: 'Work',
          },
          ownerId,
        ),
      );

      const result = await commandBus.execute(
        new CreateCategoryCommand(
          {
            name: 'Work',
          },
          secondUserId,
        ),
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('Work');
      expect(result.owner.toString()).toBe(secondUserId);
    });
  });

  // ============================================================
  // GET CATEGORIES
  // ============================================================

  describe('GetCategoriesHandler', () => {
    it('should return only categories belonging to the owner', async () => {
      await createCategory(ownerId, {
        name: 'Owner Category 1',
      });

      await createCategory(ownerId, {
        name: 'Owner Category 2',
      });

      await createCategory(secondUserId, {
        name: 'Other User Category',
      });

      const result = await queryBus.execute(new GetCategoriesQuery(ownerId));

      expect(result).toHaveLength(2);

      expect(
        result.every((category) => category.owner.toString() === ownerId),
      ).toBe(true);

      expect(
        result.some((category) => category.name === 'Other User Category'),
      ).toBe(false);
    });

    it('should return an empty array when the owner has no categories', async () => {
      await createCategory(secondUserId, {
        name: 'Other User Category',
      });

      const result = await queryBus.execute(new GetCategoriesQuery(ownerId));

      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // GET CATEGORY
  // ============================================================

  describe('GetCategoryHandler', () => {
    it('should return an owned category', async () => {
      const category = await createCategory(ownerId, {
        name: 'Work',
        color: '#3498db',
      });

      const result = await queryBus.execute(
        new GetCategoryQuery(category._id.toString(), ownerId),
      );

      expect(result).toBeDefined();
      expect(result._id.toString()).toBe(category._id.toString());

      expect(result.name).toBe('Work');
      expect(result.owner.toString()).toBe(ownerId);
    });

    it('should reject access to another user category', async () => {
      const category = await createCategory(secondUserId, {
        name: 'Private Category',
      });

      await expect(
        queryBus.execute(
          new GetCategoryQuery(category._id.toString(), ownerId),
        ),
      ).rejects.toThrow('Category not found');
    });

    it('should reject a category that does not exist', async () => {
      const mongoose = categoryModel.base;

      const missingId = new mongoose.Types.ObjectId();

      await expect(
        queryBus.execute(new GetCategoryQuery(missingId.toString(), ownerId)),
      ).rejects.toThrow('Category not found');
    });
  });

  // ============================================================
  // UPDATE CATEGORY
  // ============================================================

  describe('UpdateCategoryHandler', () => {
    it('should update an owned category and increment the version', async () => {
      const category = await createCategory(ownerId, {
        name: 'Original',
        color: '#000000',
      });

      const expectedVersion = category.__v;

      const result = await commandBus.execute(
        new UpdateCategoryCommand(
          category._id.toString(),
          {
            name: 'Updated',
            color: '#ffffff',
          },
          ownerId,
          expectedVersion,
        ),
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated');
      expect(result.color).toBe('#ffffff');

      expect(result.__v).toBe(expectedVersion + 1);

      const updated = await categoryModel.findById(category._id).lean();

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated');
      expect(updated!.color).toBe('#ffffff');
      expect(updated!.__v).toBe(expectedVersion + 1);
    });

    it('should reject an update with a stale version', async () => {
      const category = await createCategory(ownerId, {
        name: 'Version Test',
      });

      const expectedVersion = category.__v;

      await commandBus.execute(
        new UpdateCategoryCommand(
          category._id.toString(),
          {
            name: 'First Update',
          },
          ownerId,
          expectedVersion,
        ),
      );

      await expect(
        commandBus.execute(
          new UpdateCategoryCommand(
            category._id.toString(),
            {
              name: 'Should Fail',
            },
            ownerId,
            expectedVersion,
          ),
        ),
      ).rejects.toThrow(
        'Category has been modified. Please refresh and try again.',
      );

      const unchanged = await categoryModel.findById(category._id).lean();

      expect(unchanged!.name).toBe('First Update');
    });

    it('should reject updating another user category', async () => {
      const category = await createCategory(secondUserId, {
        name: 'Private Category',
      });

      await expect(
        commandBus.execute(
          new UpdateCategoryCommand(
            category._id.toString(),
            {
              name: 'Unauthorized Update',
            },
            ownerId,
            category.__v,
          ),
        ),
      ).rejects.toThrow('Category not found');

      const unchanged = await categoryModel.findById(category._id).lean();

      expect(unchanged!.name).toBe('Private Category');
    });
  });

  // ============================================================
  // DELETE CATEGORY
  // ============================================================

  describe('DeleteCategoryHandler', () => {
    it('should delete an owned category', async () => {
      const category = await createCategory(ownerId, {
        name: 'To Delete',
      });

      const result = await commandBus.execute(
        new DeleteCategoryCommand(category._id.toString(), ownerId),
      );

      expect(result).toEqual({
        message: 'Category Deleted Successfully',
      });

      const deleted = await categoryModel.findById(category._id).lean();

      expect(deleted).toBeNull();
    });

    it('should reject deleting another user category', async () => {
      const category = await createCategory(secondUserId, {
        name: 'Private Category',
      });

      await expect(
        commandBus.execute(
          new DeleteCategoryCommand(category._id.toString(), ownerId),
        ),
      ).rejects.toThrow('Category not found');

      const stillExists = await categoryModel.findById(category._id).lean();

      expect(stillExists).toBeDefined();
      expect(stillExists!.owner.toString()).toBe(secondUserId);
    });

    it('should reject deleting a category that does not exist', async () => {
      const mongoose = categoryModel.base;

      const missingId = new mongoose.Types.ObjectId();

      await expect(
        commandBus.execute(
          new DeleteCategoryCommand(missingId.toString(), ownerId),
        ),
      ).rejects.toThrow('Category not found');
    });
  });
});
