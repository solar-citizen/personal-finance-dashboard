import type { GeminiModel } from './gemini-client.types';

export function isGeminiModelsListResponse(
  data: unknown,
): data is { models: GeminiModel[] } {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  if (!('models' in data)) {
    return false;
  }

  const models = data.models;

  if (!Array.isArray(models)) {
    return false;
  }

  return models.every((model: unknown) => {
    if (typeof model !== 'object' || model === null) {
      return false;
    }

    return (
      'name' in model &&
      'displayName' in model &&
      'supportedGenerationMethods' in model &&
      typeof model.name === 'string' &&
      typeof model.displayName === 'string' &&
      Array.isArray(model.supportedGenerationMethods)
    );
  });
}
