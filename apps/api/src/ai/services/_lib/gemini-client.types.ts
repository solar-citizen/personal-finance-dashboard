export type GeminiGenerationMethod =
  | 'generateContent'
  | 'countTokens'
  | 'createCachedContent'
  | 'batchGenerateContent';

export type GeminiModel = {
  name: string;
  version: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: GeminiGenerationMethod[];
  temperature?: number;
  maxTemperature?: number;
  topP?: number;
  topK?: number;
};

type GeminiModelSummary = {
  name: string;
  displayName: string;
  description: string;
  supportedMethods: GeminiGenerationMethod[];
};

export type AvailableModelsResponse = {
  total: number;
  contentGenerationModels: GeminiModelSummary[];
  allModels: string[];
};

export type AvailableModelsErrorResponse = {
  error: string;
};
