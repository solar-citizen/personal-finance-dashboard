import { Module } from '@nestjs/common';
import { AiModule } from 'src/ai/ai.module';

import { PrivatBankController } from './privatbank.controller';
import { PrivatBankService } from './privatbank.service';
import { PrivatBankCategoryService } from './services/privatbank-category.service';
import { PrivatBankParserService } from './services/privatbank-parser.service';

@Module({
  imports: [AiModule],
  controllers: [PrivatBankController],
  providers: [
    PrivatBankService,
    PrivatBankParserService,
    PrivatBankCategoryService,
  ],
  exports: [PrivatBankService],
})
export class PrivatBankModule {}
