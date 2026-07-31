export function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
