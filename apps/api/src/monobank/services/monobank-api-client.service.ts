import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from 'src/config/config.service';
import { toUnixTimestamp } from 'src/lib/utils/date.util';

import type {
  MonoBankClientInfo,
  MonoBankTransaction,
} from '../lib/monobank.types';
import { isAxiosErrorWithResponse } from '../lib/utils/common.util';

type GetStatementData = {
  token: string;
  accountId: string;
  from: Date;
  to: Date;
};

@Injectable()
export class MonoBankApiClient {
  private readonly logger = new Logger(MonoBankApiClient.name);
  private readonly apiUrl: string;
  private readonly rateLimitDelay = 60000;
  private lastRequestTime = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.monoApiUrl;
  }

  async getClientInfo(token: string): Promise<MonoBankClientInfo> {
    await this.waitForRateLimit();

    try {
      const response = await firstValueFrom(
        this.httpService.get<MonoBankClientInfo>(
          `${this.apiUrl}/personal/client-info`,
          {
            headers: { 'X-Token': token },
          },
        ),
      );

      return response.data;
    } catch (err) {
      this.handleMonoBankError(err);
    }
  }

  async getStatement({
    accountId,
    token,
    from,
    to,
  }: GetStatementData): Promise<MonoBankTransaction[]> {
    await this.waitForRateLimit();

    const fromTimestamp = toUnixTimestamp(from);
    const toTimestamp = toUnixTimestamp(to);

    try {
      const response = await firstValueFrom(
        this.httpService.get<MonoBankTransaction[]>(
          `${this.apiUrl}/personal/statement/${accountId}/${fromTimestamp}/${toTimestamp}`,
          {
            headers: { 'X-Token': token },
          },
        ),
      );

      return response.data;
    } catch (err) {
      this.handleMonoBankError(err);
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      this.logger.log(`Rate limit: waiting ${Math.ceil(waitTime / 1000)}s`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  private handleMonoBankError(err: unknown): never {
    if (isAxiosErrorWithResponse(err)) {
      const status = err.response.status;
      const data = err.response.data;

      this.logger.error(`MonoBank API error (${status}):`, data);

      if (status === 429) {
        throw new HttpException(
          'Too many requests to MonoBank API. Please wait 60 seconds.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (status === 403) {
        throw new HttpException(
          'Invalid MonoBank token or insufficient permissions',
          HttpStatus.FORBIDDEN,
        );
      }

      throw new HttpException(
        data.errorDescription || 'MonoBank API error',
        status,
      );
    }

    this.logger.error('Unexpected error:', err);
    throw new HttpException(
      'Failed to connect to MonoBank API',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
