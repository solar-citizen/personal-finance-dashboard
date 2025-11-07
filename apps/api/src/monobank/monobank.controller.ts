import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConnectMonoBankDto, SyncTransactionsDto } from './monobank.dto';
import { MonoBankService } from './monobank.service';
import type { MonoBankAccountResponse, SyncResultResponse } from './lib/types';

@ApiTags('Mono')
@Controller('api/mono')
@UseGuards(JwtAuthGuard)
export class MonoBankController {
  constructor(private readonly monoBankService: MonoBankService) {}

  @Post('connect')
  async connectAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: ConnectMonoBankDto,
  ): Promise<{ accounts: MonoBankAccountResponse[] }> {
    const accounts = await this.monoBankService.connectAccount(userId, dto);
    return { accounts };
  }

  @Get('accounts')
  async getAccounts(
    @CurrentUser('id') userId: string,
  ): Promise<{ accounts: MonoBankAccountResponse[] }> {
    const accounts = await this.monoBankService.getUserAccounts(userId);
    return { accounts };
  }

  @Post('sync/:accountId')
  async syncTransactions(
    @CurrentUser('id') userId: string,
    @Param('accountId') accountId: string,
    @Query() dto: SyncTransactionsDto,
  ): Promise<SyncResultResponse> {
    return this.monoBankService.syncTransactions(userId, accountId, dto);
  }
}
