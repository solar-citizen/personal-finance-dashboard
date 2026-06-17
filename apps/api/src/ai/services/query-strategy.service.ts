import { Injectable, Logger } from '@nestjs/common';

import { analyticalFinancePatterns } from './lib/analytical-patterns';

export type ContextLevel = 'full' | 'minimal';
type QueryType = 'financial' | 'casual';
type Provider = 'gemini' | 'ollama';
type QueryStrategy = {
  type: QueryType;
  provider: Provider;
  contextLevel: ContextLevel;
  reason: string;
};

@Injectable()
export class QueryStrategyService {
  private readonly logger = new Logger(QueryStrategyService.name);

  analyzeQuery(
    message: string,
    geminiAvailable: boolean,
    isLockedToGemini: boolean,
  ): QueryStrategy {
    if (isLockedToGemini && !geminiAvailable) {
      throw new Error(
        'Conversation is locked to Gemini but Gemini is currently unavailable',
      );
    }

    const isFinancial = analyticalFinancePatterns.some((pattern) =>
      pattern.test(message),
    );

    if (isLockedToGemini || isFinancial) {
      const provider = geminiAvailable ? 'gemini' : 'ollama';

      return {
        type: 'financial',
        provider,
        contextLevel: 'full',
        reason: isLockedToGemini
          ? geminiAvailable
            ? 'Conversation locked to Gemini'
            : 'Conversation locked to Gemini — falling back to Ollama'
          : `Financial analysis with ${provider}`,
      };
    }

    return {
      type: 'casual',
      provider: 'ollama',
      contextLevel: 'minimal',
      reason: 'Non-financial chat with Ollama + minimal context',
    };
  }

  logStrategy(
    { provider, contextLevel, reason, type }: QueryStrategy,
    message: string,
  ): void {
    this.logger.log(
      `Type: ${type.toUpperCase()} | ` +
        `Strategy: ${provider.toUpperCase()} + ${contextLevel} context | ` +
        `Reason: ${reason} | Query: "${message.substring(0, 50)}..."`,
    );
  }
}
