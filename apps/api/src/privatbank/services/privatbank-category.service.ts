import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';

@Injectable()
export class PrivatBankCategoryService {
  private categoryCache: { id: string; name: string }[] | null = null;

  constructor(private readonly prismaService: PrismaService) {}

  async resolveCategoryId(categoryName: string): Promise<string | null> {
    this.categoryCache ??= await this.prismaService.category.findMany({
      select: { id: true, name: true },
    });

    const trimmed = categoryName.trim();
    const exact = this.categoryCache.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );

    if (exact) {
      return exact.id;
    }

    const trimmedLower = trimmed.toLowerCase();

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
      if (
        trimmedLower.includes(key) ||
        aliases.some((a) => trimmedLower.includes(a))
      ) {
        const matched = this.categoryCache.find(
          (c) =>
            aliases.some((a) => c.name.toLowerCase().includes(a)) ||
            c.name.toLowerCase().includes(key),
        );

        if (matched) {
          return matched.id;
        }
      }
    }

    for (const cat of this.categoryCache) {
      const catLower = cat.name.toLowerCase();

      if (trimmedLower.includes(catLower) || catLower.includes(trimmedLower)) {
        return cat.id;
      }
    }

    // Fallback to "Інше"
    const fallback = this.categoryCache.find((c) => c.name === 'Інше');

    return fallback ? fallback.id : null;
  }
}
