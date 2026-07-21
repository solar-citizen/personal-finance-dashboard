import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { getErrorMessage } from 'src/_lib/utils';
import { dayMs, hourMs, weekMs } from 'src/_lib/utils/date.util';
import type { DateRange } from 'src/_lib/utils/date-range.util';

import { CachedBundle } from './context-builder.types';
import { assertIsCachedBundle } from './utils';

const cacheKeyPrefix = 'context';
const cacheTtlMs = 600_000;
const isExceedsDay = (diff: number) => diff > dayMs;
const isExceedsWeek = (diff: number) => diff > weekMs;

@Injectable()
export class ContextCacheService {
  private readonly logger = new Logger(ContextCacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  buildCacheKey(userId: string, { from, to }: DateRange): string {
    const fromTime = from.getTime();
    const toTime = to.getTime();
    const diff = toTime - fromTime;

    const bucketSize = this.getBucketSize(diff);
    const bucketedFrom = this.bucketTimestamp(fromTime, bucketSize);
    const bucketedTo = this.bucketTimestamp(toTime, bucketSize);

    return `${cacheKeyPrefix}:${userId}:${bucketedFrom}:${bucketedTo}`;
  }

  async get(cacheKey: string): Promise<CachedBundle | undefined> {
    return await this.cacheManager.get<CachedBundle>(cacheKey);
  }

  async set(cacheKey: string, value: CachedBundle): Promise<void> {
    try {
      const safeValue = this.toJsonSafe(value);
      await this.cacheManager.set(cacheKey, safeValue, cacheTtlMs);
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to cache context bundle for key ${cacheKey}: ${getErrorMessage(err)}`,
      );
    }
  }

  async clear(userId?: string): Promise<void> {
    if (userId) {
      await this.cacheManager.del(`${cacheKeyPrefix}:${userId}`);
      this.logger.log(`Cleared cache for user ${userId}`);
    } else {
      await this.cacheManager.clear();
      this.logger.log('Cleared all cached prompts');
    }
  }

  private getBucketSize(diff: number): number {
    if (isExceedsWeek(diff)) {
      return dayMs;
    }

    if (isExceedsDay(diff)) {
      return hourMs;
    }

    return cacheTtlMs;
  }

  private bucketTimestamp(time: number, bucketSize: number): number {
    return Math.floor(time / bucketSize) * bucketSize;
  }

  private toJsonSafe(value: CachedBundle): CachedBundle {
    const json = JSON.stringify(value, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );

    const parsed: unknown = JSON.parse(json);
    assertIsCachedBundle(parsed);

    return parsed;
  }
}
