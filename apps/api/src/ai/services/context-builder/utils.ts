import { CachedBundle } from './context-builder.types';

export function assertIsCachedBundle(
  value: unknown,
): asserts value is CachedBundle {
  if (typeof value !== 'object' || value === null) {
    throw new Error(
      'Sanitizing the context bundle for caching produced an invalid value',
    );
  }
}
