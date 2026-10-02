import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { PrismaService } from 'src/db/prisma.service';

import { PrivatBankCategoryService } from './privatbank-category.service';

const mockCategories = [
  { id: 'cat-1', name: 'Аптеки' },
  { id: 'cat-2', name: 'Продукти' },
  { id: 'cat-3', name: 'Інше' },
];

describe('PrivatBankCategoryService', () => {
  let service: PrivatBankCategoryService;

  beforeEach(() => {
    const findMany = mock(() => Promise.resolve(mockCategories));
    const prismaMock = { category: { findMany } };

    service = new PrivatBankCategoryService(
      prismaMock as unknown as PrismaService,
    );
  });

  it('should return exact name match if found', async () => {
    const catId = await service.resolveCategoryId('Аптеки');

    expect(catId).toBe('cat-1');
  });

  it('should return fuzzy keyword match if exact name not found', async () => {
    const catId = await service.resolveCategoryId('Супермаркети та продукти');

    expect(catId).toBe('cat-2');
  });

  it('should fallback to default "Інше" category if no match found', async () => {
    const catId = await service.resolveCategoryId('Невідома Категорія');

    expect(catId).toBe('cat-3');
  });
});
