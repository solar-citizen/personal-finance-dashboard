import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ConnectMonoBankDto,
  MonoBankAccountResponseDto,
  SyncJobResponseDto,
  SyncProgressResponseDto,
  SyncResultResponseDto,
  SyncTransactionsDto,
} from 'src/@generated/zod/pfd-dtos';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MonoBankService } from './monobank.service';

@ApiTags('Mono')
@Controller('api/mono')
@UseGuards(JwtAuthGuard)
export class MonoBankController {
  constructor(private readonly monoBankService: MonoBankService) {}

  @Post('connect')
  async connectAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: ConnectMonoBankDto,
  ): Promise<{ accounts: MonoBankAccountResponseDto[] }> {
    const accounts = await this.monoBankService.connectAccount(userId, dto);
    return { accounts };
  }

  @Get('accounts')
  async getAccounts(
    @CurrentUser('id') userId: string,
  ): Promise<{ accounts: MonoBankAccountResponseDto[] }> {
    const accounts = await this.monoBankService.getUserAccounts(userId);
    return { accounts };
  }

  @Post('sync/:accountId')
  async syncTransactions(
    @CurrentUser('id') userId: string,
    @Param('accountId') accountId: string,
    @Body() dto?: SyncTransactionsDto,
  ): Promise<SyncResultResponseDto | SyncJobResponseDto> {
    return this.monoBankService.syncTransactions(userId, accountId, dto);
  }

  @Get('sync-status/:jobId')
  async getSyncStatus(
    @Param('jobId') jobId: string,
  ): Promise<SyncProgressResponseDto> {
    return this.monoBankService.getSyncJobStatus(jobId);
  }
}
