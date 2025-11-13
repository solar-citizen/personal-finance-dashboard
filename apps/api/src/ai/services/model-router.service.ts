import { Injectable, Logger } from '@nestjs/common';
import { analyticalPatterns } from './lib/analytical-patterns';

type ModelProvider = 'gemini' | 'ollama';

export type ModelSelection = {
  provider: ModelProvider;
  reason: string;
};

@Injectable()
export class ModelRouterService {
  private readonly logger = new Logger(ModelRouterService.name);

  selectModel(
    message: string,
    hasFinancialContext: boolean,
    geminiAvailable: boolean,
  ): ModelSelection {
    if (!geminiAvailable) {
      return {
        provider: 'ollama',
        reason: 'Gemini unavailable - using fallback',
      };
    }

    const isAnalytical = analyticalPatterns.some((pattern) =>
      pattern.test(message),
    );

    if (isAnalytical || hasFinancialContext) {
      return {
        provider: 'gemini',
        reason: 'Analytical query with financial context',
      };
    }

    // Complex questions - prefer Gemini
    const questionWords = (message.match(/\?/g) || []).length;
    const wordCount = message.split(/\s+/).length;

    if (questionWords > 1 || wordCount > 50) {
      return {
        provider: 'gemini',
        reason: 'Complex multi-part query',
      };
    }

    // Simple chat - use Ollama for speed
    if (wordCount < 20) {
      return {
        provider: 'ollama',
        reason: 'Simple query - local model sufficient',
      };
    }

    // Default to Gemini for better quality
    return {
      provider: 'gemini',
      reason: 'Default to Gemini for quality',
    };
  }

  logSelection(selection: ModelSelection, message: string): void {
    this.logger.log(
      `Selected ${selection.provider.toUpperCase()}: ${selection.reason} | Message: "${message.substring(0, 50)}..."`,
    );
  }
}
