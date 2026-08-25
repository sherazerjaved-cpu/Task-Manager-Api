import { Category } from '../../Schema/categories.schema';

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');

export interface ICategoryRepository {
  create(category: any): Promise<Category>;

  findAll(ownerId: string): Promise<Category[]>;

  findById(id: string, ownerId: string): Promise<Category | null>;

  findByIdForRole(
    id: string,
    ownerId: string,
    role: string,
  ): Promise<Category | null>;

  update(
    id: string,
    ownerId: string,
    category: Partial<Category>,
    expectedVersion: number,
  ): Promise<Category | null>;

  delete(id: string, ownerId: string): Promise<Category | null>;
}
