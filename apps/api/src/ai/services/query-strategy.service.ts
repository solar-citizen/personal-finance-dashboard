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

  analyzeQuery(message: string, geminiAvailable: boolean): QueryStrategy {
    const isFinancial = analyticalFinancePatterns.some((pattern) =>
      pattern.test(message),
    );

    if (isFinancial) {
      return {
        type: 'financial',
        provider: geminiAvailable ? 'gemini' : 'ollama',
        contextLevel: 'full',
        reason: geminiAvailable
          ? 'Financial analysis with Gemini + full context'
          : 'Financial analysis with Ollama fallback + full context',
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
