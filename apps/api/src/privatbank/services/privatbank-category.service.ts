import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';

function includesIgnoreCase(value: string, search: string): boolean {
  return value.toLowerCase().includes(search);
}

@Injectable()
export class PrivatBankCategoryService {
  private categoryCache: { id: string; name: string }[] | null = null;

  constructor(private readonly prismaService: PrismaService) {}

  async resolveCategoryId(categoryName: string): Promise<string | null> {
    this.categoryCache ??= await this.prismaService.category.findMany({
      select: { id: true, name: true },
    });

    const trimmed = categoryName.trim().toLowerCase();
    const exact = this.categoryCache.find(
      ({ name }) => name.toLowerCase() === trimmed,
    );

    if (exact) {
      return exact.id;
    }

    // Keyword heuristics map
    const keywords: Record<string, string[]> = {
      супермаркет: ['продукти', 'супермаркет'],
      ресторан: ['ресторан', 'кафе', 'бар'],
      таксі: ['таксі', 'транспорт'],
      'зняття готівки': ['зняття', 'готівка'],
      'поповнення мобільного': ['мобільн', 'телефон'],
      аптек: ['аптек', 'ліки'],
    };

    for (const [key, aliases] of Object.entries(keywords)) {
      if (trimmed.includes(key) || aliases.some((a) => trimmed.includes(a))) {
        const matched = this.categoryCache.find(
          ({ name }) =>
            aliases.some((a) => includesIgnoreCase(name, a)) ||
            includesIgnoreCase(name, key),
        );

        if (matched) {
          return matched.id;
        }
      }
    }

    for (const { id, name } of this.categoryCache) {
      const catLower = name.toLowerCase();

      if (trimmed.includes(catLower) || catLower.includes(trimmed)) {
        return id;
      }
    }

    // Fallback to "Інше"
    const fallback = this.categoryCache.find(({ name }) => name === 'Інше');

    return fallback ? fallback.id : null;
  }
}
