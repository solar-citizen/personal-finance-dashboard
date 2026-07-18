import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { Observable } from 'rxjs';
import { ConfigService } from 'src/config/config.service';

import {
  AvailableModelsErrorResponse,
  AvailableModelsResponse,
  GeminiModel,
} from './_lib/gemini-client.types';
import { isGeminiModelsListResponse } from './_lib/utils';

export type GeminiChatMessage = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

@Injectable()
export class GeminiClientService {
  private readonly logger = new Logger(GeminiClientService.name);
  private readonly genAI?: GoogleGenerativeAI;
  private readonly model?: GenerativeModel;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.geminiApiKey;

    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set - Gemini features disabled');
      return;
    }

    const model = this.configService.geminiModel;

    if (!model) {
      this.logger.warn('GEMINI_MODEL not set - Gemini features disabled');
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

    this.logger.log(`Gemini client initialized: ${model}`);
  }

  async chat(
    systemPrompt: string,
    messages: GeminiChatMessage[],
  ): Promise<{
    response: string;
    tokensUsed?: number;
  }> {
    if (!this.model || !this.genAI) {
      throw new Error('Gemini client not initialized');
    }

    const startTime = dayjs();

    try {
      const chat = this.model.startChat({
        history: messages.slice(0, -1).map(({ role, parts }) => ({
          role,
          parts,
        })),
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }],
        },
      });

      const lastMessage = messages[messages.length - 1];
      const { response } = await chat.sendMessage(lastMessage.parts[0].text);

      this.logDuration('Chat completed', startTime);

      return {
        response: response.text(),
        tokensUsed: response.usageMetadata?.totalTokenCount,
      };
    } catch (err: unknown) {
      this.logger.error('Gemini chat error:', err);
      throw err;
    }
  }

  chatStream(
    systemPrompt: string,
    messages: GeminiChatMessage[],
  ): Observable<string> {
    return new Observable((subscriber) => {
      const startTime = dayjs();

      (async () => {
        if (!this.model || !this.genAI) {
          throw new Error('Gemini client not initialized');
        }

        const chat = this.model.startChat({
          history: messages.slice(0, -1),
          systemInstruction: {
            role: 'system',
            parts: [{ text: systemPrompt }],
          },
        });

        const lastMessage = messages[messages.length - 1];
        const { stream } = await chat.sendMessageStream(
          lastMessage.parts[0].text,
        );

        for await (const chunk of stream) {
          const text = chunk.text();

          if (text) {
            subscriber.next(text);
          }
        }

        this.logDuration('Stream completed', startTime);
        subscriber.complete();
      })().catch((err: unknown) => {
        this.logger.error('Uncaught Gemini stream error:', err);
        subscriber.error(err);
      });
    });
  }

  async healthCheck(): Promise<boolean> {
    if (!this.model || !this.genAI) {
      return false;
    }

    try {
      return !!(await this.model.generateContent('test')).response.text();
    } catch (err: unknown) {
      this.logger.error('Gemini health check failed:', err);
      return false;
    }
  }

  async listAvailableModels(): Promise<
    AvailableModelsResponse | AvailableModelsErrorResponse
  > {
    const apiKey = this.configService.geminiApiKey;

    if (!apiKey) {
      return { error: 'GEMINI_API_KEY not configured' };
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error('Failed to list models:', error);

        return { error: `HTTP ${response.status}: ${error}` };
      }

      const data: unknown = await response.json();

      if (!isGeminiModelsListResponse(data)) {
        throw new Error('Invalid response format from Gemini API');
      }

      const { models } = data;

      const contentGenerationModels: GeminiModel[] = models.filter(
        ({ supportedGenerationMethods }: GeminiModel) =>
          supportedGenerationMethods.includes('generateContent'),
      );

      this.logger.log(
        `Found ${contentGenerationModels.length} models supporting generateContent`,
      );

      return {
        total: models.length || 0,
        contentGenerationModels: contentGenerationModels.map(
          ({ name, displayName, description, supportedGenerationMethods }) => ({
            name,
            displayName,
            description,
            supportedMethods: supportedGenerationMethods,
          }),
        ),
        allModels: models.map(({ name }) => name),
      };
    } catch (err: unknown) {
      this.logger.error('Error listing models:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      return { error: errorMessage };
    }
  }

  isAvailable(): boolean {
    return this.model !== undefined && this.genAI !== undefined;
  }

  private assertAvailable(): asserts this is this & {
    model: GenerativeModel;
    genAI: GoogleGenerativeAI;
  } {
    if (!this.model || !this.genAI) {
      throw new Error('Gemini client not initialized');
    }
  }

  private logDuration(message: string, startTime: dayjs.Dayjs): void {
    const duration = dayjs().diff(startTime);
    this.logger.log(`${message} in ${duration}ms`);
  }
}
