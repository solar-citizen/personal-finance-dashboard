# PrivatBank XLSX Upload & Account Blending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete upload and normalization mechanism for PrivatBank `.xlsx` account statements, enabling account creation/selection, deduplicated transaction upserting, category matching, and unified display alongside Monobank data across the dashboard.

**Architecture:** Extend Prisma schema to support bank-agnostic accounts and optional MCC codes. Create a NestJS `PrivatBankModule` (`PrivatBankParserService`, `PrivatBankCategoryService`, `PrivatBankService`, `PrivatBankController`). Re-run monorepo codegen (`bun run codegen`) to produce frontend React Query hooks, then implement `PrivatBankUploadModal` and update `AccountsSummary` in Next.js (`apps/web`).

**Tech Stack:** NestJS, Prisma PostgreSQL, `exceljs`, Zod (`nestjs-zod`), React Query (OpenAPI codegen), Next.js 14 App Router, i18next, Bun.

## Global Constraints

- **TypeScript strict mode:** No `any` types, respect `tsconfig.json` and `eslint.config.mjs`.
- **Naming Conventions:** `camelCase` for variables/functions/Zod schema files, `PascalCase` for classes/types/schemas, `SCREAMING_SNAKE_CASE` for env vars.
- **API Contracts & Codegen:** Every controller return type must be a named DTO class generated from Zod schema via `bun run codegen`. Never write manual frontend fetch calls or custom TS types for API data.
- **Default Exports:** Components and pages in `apps/web` use default exports (`export default function Component()`).
- **Formatting & Strings:** Always write text content as explicit strings in JSX (`{'text'}`).
- **Timezone:** Timestamps stored and processed as UTC ISO strings.

---

### Task 1: Database Schema & Shared Types Update

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `Bank` enum (`monobank`, `privatbank`), optional `Account.type`, optional `Transaction.mcc`, new fields `Account.bank`, `Account.name`, `Account.maskedPan`.

- [ ] **Step 1: Update Prisma schema**

Edit `apps/api/prisma/schema.prisma`:
1. Add `enum Bank { monobank privatbank }`
2. Update `Account`:
   ```prisma
   model Account {
     id          String       @id @default(cuid())
     userId      String
     user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
     
     bank        Bank         @default(monobank)
     name        String?
     maskedPan   String?

     accountId   String
     iban        String?
     type        AccountType?
     currency    Currency     @default(uah)
     balance     BigInt
     creditLimit BigInt       @default(0)
     
     monoToken    String?
     lastSyncedAt DateTime?

     syncJobs     SyncJob[]
     transactions Transaction[]
     
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     
     @@unique([userId, accountId])
     @@index([userId])
   }
   ```
3. Update `Transaction`:
   ```prisma
   model Transaction {
     id         String   @id @default(cuid())
     accountId  String
     account    Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
     
     externalId  String
     time        DateTime
     description String
     
     mcc         Int?
     originalMcc Int?
     hold        Boolean  @default(false)
     
     amount            BigInt
     operationAmount   BigInt
     currencyCode      Int
     
     commissionRate    BigInt @default(0)
     cashbackAmount    BigInt @default(0)
     balance           BigInt
     
     comment           String?
     receiptId         String?
     invoiceId         String?
     
     counterEdrpou     String?
     counterIban       String?
     counterName       String?
     
     categoryId String?
     category   Category? @relation(fields: [categoryId], references: [id])
     
     createdAt DateTime @default(now())
     
     @@unique([accountId, externalId])
     @@index([accountId, time])
     @@index([categoryId])
   }
   ```

- [ ] **Step 2: Push database schema and generate Prisma client**

Run:
```bash
cd apps/api && bun prisma db push && bun run db:generate
```
Expected: Database updated, Prisma Client re-generated without errors.

- [ ] **Step 3: Update shared package helper types**

Edit `packages/shared/src/index.ts`:
```ts
export const bankNames: Record<string, string> = {
  monobank: 'Monobank',
  privatbank: 'ПриватБанк',
};
```

- [ ] **Step 4: Verify shared package build**

Run from root:
```bash
bun run lint
```
Expected: Pass without errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma packages/shared/src/index.ts
git commit -m "feat(db): update Account and Transaction models for PrivatBank support"
```

---

### Task 2: Install `exceljs` & Build `PrivatBankParserService`

**Files:**
- Create: `apps/api/src/privatbank/services/privatbank-parser.service.ts`
- Create: `apps/api/src/privatbank/services/privatbank-parser.service.spec.ts`

**Interfaces:**
- Consumes: `Buffer` of `.xlsx` file
- Produces: `PrivatBankParserService.parseXlsx(buffer: Buffer): Promise<ParsedPrivatBankStatement>`
  ```ts
  export type ParsedPrivatTransaction = {
    time: Date;
    categoryName: string;
    maskedPan: string;
    description: string;
    amount: bigint; // in kopiykas
    operationAmount: bigint;
    currencyCode: number; // 980 for UAH
    balance: bigint; // in kopiykas
    externalId: string; // SHA-256 hash
  };

  export type ParsedPrivatBankStatement = {
    maskedPan: string;
    periodFrom: Date;
    periodTo: Date;
    currency: 'uah' | 'usd' | 'eur';
    latestBalance: bigint;
    transactions: ParsedPrivatTransaction[];
  };
  ```

- [ ] **Step 1: Install `exceljs` in `apps/api`**

Run:
```bash
cd apps/api && bun add exceljs && bun add -D @types/multer
```

- [ ] **Step 2: Write failing unit test for `PrivatBankParserService`**

Create `apps/api/src/privatbank/services/privatbank-parser.service.spec.ts`:
```ts
import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrivatBankParserService } from './privatbank-parser.service';

describe('PrivatBankParserService', () => {
  const service = new PrivatBankParserService();
  const sampleFilePath = path.resolve(process.cwd(), '../../Y2H6sDPKT2ONjps3leJlDx1GrRTJflI7ig7bSUQEtik.xlsx');

  it('should correctly parse the reference PrivatBank statement', async () => {
    const fileBuffer = fs.readFileSync(sampleFilePath);
    const parsed = await service.parseXlsx(fileBuffer);

    expect(parsed.maskedPan).toBe('4149 **** **** 8602');
    expect(parsed.currency).toBe('uah');
    expect(parsed.transactions.length).toBeGreaterThan(0);

    const firstTx = parsed.transactions[0];
    expect(firstTx.maskedPan).toBe('4149 **** **** 8602');
    expect(firstTx.amount).toBeLessThan(0n); // negative for expense
    expect(firstTx.externalId).toBeDefined();
    expect(firstTx.externalId.length).toBe(64); // SHA-256 hex string length
  });
});
```

- [ ] **Step 3: Run test to verify failure**

Run:
```bash
cd apps/api && bun test src/privatbank/services/privatbank-parser.service.spec.ts
```
Expected: FAIL (Cannot find module `./privatbank-parser.service`)

- [ ] **Step 4: Implement `PrivatBankParserService`**

Create `apps/api/src/privatbank/services/privatbank-parser.service.ts`:
```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import ExcelJS from 'exceljs';

export type ParsedPrivatTransaction = {
  time: Date;
  categoryName: string;
  maskedPan: string;
  description: string;
  amount: bigint;
  operationAmount: bigint;
  currencyCode: number;
  balance: bigint;
  externalId: string;
};

export type ParsedPrivatBankStatement = {
  maskedPan: string;
  periodFrom: Date;
  periodTo: Date;
  currency: 'uah' | 'usd' | 'eur';
  latestBalance: bigint;
  transactions: ParsedPrivatTransaction[];
};

@Injectable()
export class PrivatBankParserService {
  async parseXlsx(buffer: Buffer): Promise<ParsedPrivatBankStatement> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('The uploaded file is empty or invalid.');
    }

    const transactions: ParsedPrivatTransaction[] = [];
    let detectedPan = '';
    let currency: 'uah' | 'usd' | 'eur' = 'uah';

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return; // Row 1 is title metadata, Row 2 is column header

      const rawDate = this.getCellValue(row.getCell(1));
      const categoryName = this.getCellValue(row.getCell(2));
      const maskedPan = this.getCellValue(row.getCell(3));
      const description = this.getCellValue(row.getCell(4));
      const rawCardAmount = this.getCellValue(row.getCell(5));
      const cardCurrency = this.getCellValue(row.getCell(6)).toLowerCase();
      const rawTxAmount = this.getCellValue(row.getCell(7));
      const rawEndingBalance = this.getCellValue(row.getCell(9));

      if (!rawDate || !maskedPan || !rawCardAmount) return;

      if (!detectedPan) detectedPan = maskedPan;
      if (cardCurrency === 'usd' || cardCurrency === 'eur' || cardCurrency === 'uah') {
        currency = cardCurrency;
      }

      const time = this.parseDate(rawDate);
      const amount = this.amountToKopiykas(rawCardAmount);
      const opAmount = this.amountToKopiykas(rawTxAmount || rawCardAmount);
      const balance = this.amountToKopiykas(rawEndingBalance || '0');

      const externalId = crypto
        .createHash('sha256')
        .update(`${maskedPan}|${time.toISOString()}|${amount.toString()}|${description}|${balance.toString()}`)
        .digest('hex');

      transactions.push({
        time,
        categoryName,
        maskedPan,
        description,
        amount,
        operationAmount: opAmount,
        currencyCode: this.currencyToNumericCode(cardCurrency),
        balance,
        externalId,
      });
    });

    if (transactions.length === 0) {
      throw new BadRequestException('No valid transactions found in statement.');
    }

    // Sort transactions by time ascending to accurately identify period range & latest balance
    const sorted = [...transactions].sort((a, b) => a.time.getTime() - b.time.getTime());
    const periodFrom = sorted[0].time;
    const periodTo = sorted[sorted.length - 1].time;
    const latestBalance = sorted[sorted.length - 1].balance;

    return {
      maskedPan: detectedPan,
      periodFrom,
      periodTo,
      currency,
      latestBalance,
      transactions,
    };
  }

  private getCellValue(cell: ExcelJS.Cell): string {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    if (typeof cell.value === 'object' && 'result' in cell.value) {
      return String(cell.value.result ?? '').trim();
    }
    return String(cell.value).trim();
  }

  private parseDate(dateStr: string): Date {
    // Format: "29.05.2026 19:44:03"
    const parts = dateStr.split(' ');
    if (parts.length < 2) return new Date(dateStr);
    const [d, m, y] = parts[0].split('.').map(Number);
    const [h, min, s] = parts[1].split(':').map(Number);
    return new Date(Date.UTC(y, m - 1, d, h, min, s));
  }

  private amountToKopiykas(valStr: string): bigint {
    const num = parseFloat(valStr.replace(',', '.').replace(/\s+/g, ''));
    if (isNaN(num)) return 0n;
    return BigInt(Math.round(num * 100));
  }

  private currencyToNumericCode(code: string): number {
    switch (code.toLowerCase()) {
      case 'usd': return 840;
      case 'eur': return 978;
      case 'uah':
      default: return 980;
    }
  }
}
```

- [ ] **Step 5: Run unit test to verify it passes**

Run:
```bash
cd apps/api && bun test src/privatbank/services/privatbank-parser.service.spec.ts
```
Expected: PASS (1 test passed)

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json apps/api/src/privatbank/services/privatbank-parser.service.ts apps/api/src/privatbank/services/privatbank-parser.service.spec.ts
git commit -m "feat(privatbank): add PrivatBank XLSX statement parser service with unit tests"
```

---

### Task 3: Build `PrivatBankCategoryService`

**Files:**
- Create: `apps/api/src/privatbank/services/privatbank-category.service.ts`
- Create: `apps/api/src/privatbank/services/privatbank-category.service.spec.ts`

**Interfaces:**
- Consumes: Category name string from PrivatBank statement (e.g. `"Супермаркети та продукти"`, `"Таксі"`)
- Produces: `PrivatBankCategoryService.resolveCategoryId(categoryName: string): Promise<string | null>`

- [ ] **Step 1: Write unit test for `PrivatBankCategoryService`**

Create `apps/api/src/privatbank/services/privatbank-category.service.spec.ts`:
```ts
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { PrivatBankCategoryService } from './privatbank-category.service';

describe('PrivatBankCategoryService', () => {
  let service: PrivatBankCategoryService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      category: {
        findMany: mock(async () => [
          { id: 'cat-1', name: 'Аптеки' },
          { id: 'cat-2', name: 'Продукти' },
          { id: 'cat-3', name: 'Інше' },
        ]),
      },
    };
    service = new PrivatBankCategoryService(prismaMock as any);
  });

  it('should return exact name match if found', async () => {
    const catId = await service.resolveCategoryId('Аптеки');
    expect(catId).toBe('cat-1');
  });

  it('should return fuzzy keyword match if exact name not found', async () => {
    const catId = await service.resolveCategoryId('Супермаркети та продукти');
    expect(catId).toBe('cat-2'); // matches "Продукти"
  });

  it('should fallback to default "Інше" category if no match found', async () => {
    const catId = await service.resolveCategoryId('Невідома Категорія');
    expect(catId).toBe('cat-3');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:
```bash
cd apps/api && bun test src/privatbank/services/privatbank-category.service.spec.ts
```
Expected: FAIL

- [ ] **Step 3: Implement `PrivatBankCategoryService`**

Create `apps/api/src/privatbank/services/privatbank-category.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';

@Injectable()
export class PrivatBankCategoryService {
  private categoryCache: { id: string; name: string }[] | null = null;

  constructor(private readonly prismaService: PrismaService) {}

  async resolveCategoryId(categoryName: string): Promise<string | null> {
    if (!this.categoryCache) {
      this.categoryCache = await this.prismaService.category.findMany({
        select: { id: true, name: true },
      });
    }

    const trimmed = categoryName.trim();
    const exact = this.categoryCache.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exact) return exact.id;

    // Keyword heuristics map
    const keywords: Record<string, string[]> = {
      'супермаркет': ['продуктив', 'продукти', 'супермаркет'],
      'ресторан': ['ресторан', 'кафе', 'бар'],
      'таксі': ['таксі', 'транспорт'],
      'зняття готівки': ['зняття', 'готівка'],
      'поповнення мобільного': ['мобільн', 'телефон'],
      'аптек': ['аптек', 'ліки'],
    };

    const trimmedLower = trimmed.toLowerCase();
    for (const cat of this.categoryCache) {
      const catLower = cat.name.toLowerCase();
      if (trimmedLower.includes(catLower) || catLower.includes(trimmedLower)) {
        return cat.id;
      }
    }

    // Fallback to "Інше"
    const fallback = this.categoryCache.find((c) => c.name === 'Інше');
    return fallback ? fallback.id : null;
  }
}
```

- [ ] **Step 4: Run unit test to verify it passes**

Run:
```bash
cd apps/api && bun test src/privatbank/services/privatbank-category.service.spec.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/privatbank/services/privatbank-category.service.ts apps/api/src/privatbank/services/privatbank-category.service.spec.ts
git commit -m "feat(privatbank): add PrivatBank category resolution service"
```

---

### Task 4: PrivatBank Schemas, DTOs & Service

**Files:**
- Create: `apps/api/src/privatbank/privatbank.schema.ts`
- Create: `apps/api/src/privatbank/privatbank.service.ts`

**Interfaces:**
- `PrivatBankService.inspectStatement(userId: string, buffer: Buffer)`
- `PrivatBankService.uploadStatement(userId: string, buffer: Buffer, dto: UploadPrivatBankStatementDto)`

- [x] **Step 1: Define PrivatBank Zod Schemas**

Create `apps/api/src/privatbank/privatbank.schema.ts`:
```ts
import { z } from 'zod';

export const inspectPrivatBankResponseSchema = z.object({
  maskedPan: z.string(),
  periodFrom: z.string(),
  periodTo: z.string(),
  totalTransactions: z.number(),
  currency: z.enum(['uah', 'usd', 'eur']),
  matchedAccountId: z.string().nullable(),
  matchedAccountName: z.string().nullable(),
});

export const uploadPrivatBankStatementSchema = z.object({
  accountId: z.string().optional(),
  accountName: z.string().optional(),
});

export const uploadPrivatBankResponseSchema = z.object({
  accountId: z.string(),
  accountName: z.string(),
  totalParsed: z.number(),
  newTransactions: z.number(),
  updatedTransactions: z.number(),
});
```

- [x] **Step 2: Implement `PrivatBankService`**

Create `apps/api/src/privatbank/privatbank.service.ts`:
```ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SystemPromptBuilderService } from 'src/ai/services/context-builder/system-prompt-builder.service';
import { PrismaService } from 'src/db/prisma.service';
import { PrivatBankCategoryService } from './services/privatbank-category.service';
import { PrivatBankParserService } from './services/privatbank-parser.service';

@Injectable()
export class PrivatBankService {
  private readonly logger = new Logger(PrivatBankService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly parserService: PrivatBankParserService,
    private readonly categoryService: PrivatBankCategoryService,
    private readonly contextBuilder: SystemPromptBuilderService,
  ) {}

  async inspectStatement(userId: string, fileBuffer: Buffer) {
    const statement = await this.parserService.parseXlsx(fileBuffer);

    const matchedAccount = await this.prismaService.account.findFirst({
      where: {
        userId,
        maskedPan: statement.maskedPan,
      },
    });

    return {
      maskedPan: statement.maskedPan,
      periodFrom: statement.periodFrom.toISOString(),
      periodTo: statement.periodTo.toISOString(),
      totalTransactions: statement.transactions.length,
      currency: statement.currency,
      matchedAccountId: matchedAccount ? matchedAccount.id : null,
      matchedAccountName: matchedAccount ? matchedAccount.name : null,
    };
  }

  async uploadStatement(
    userId: string,
    fileBuffer: Buffer,
    dto: { accountId?: string; accountName?: string },
  ) {
    const statement = await this.parserService.parseXlsx(fileBuffer);

    let account = dto.accountId
      ? await this.prismaService.account.findFirst({ where: { id: dto.accountId, userId } })
      : await this.prismaService.account.findFirst({ where: { userId, maskedPan: statement.maskedPan } });

    if (!account) {
      const defaultName = `ПриватБанк - ${statement.maskedPan.slice(-4)}`;
      const name = dto.accountName?.trim() || defaultName;

      account = await this.prismaService.account.create({
        data: {
          userId,
          bank: 'privatbank',
          name,
          maskedPan: statement.maskedPan,
          accountId: `privat_${statement.maskedPan.replace(/\s+/g, '')}_${Date.now()}`,
          currency: statement.currency,
          balance: statement.latestBalance,
        },
      });
    }

    let newCount = 0;
    let updatedCount = 0;

    for (const tx of statement.transactions) {
      const categoryId = await this.categoryService.resolveCategoryId(tx.categoryName);

      const existing = await this.prismaService.transaction.findUnique({
        where: {
          accountId_externalId: {
            accountId: account.id,
            externalId: tx.externalId,
          },
        },
      });

      if (existing) {
        await this.prismaService.transaction.update({
          where: { id: existing.id },
          data: {
            categoryId,
            balance: tx.balance,
          },
        });
        updatedCount++;
      } else {
        await this.prismaService.transaction.create({
          data: {
            accountId: account.id,
            externalId: tx.externalId,
            time: tx.time,
            description: tx.description,
            amount: tx.amount,
            operationAmount: tx.operationAmount,
            currencyCode: tx.currencyCode,
            balance: tx.balance,
            categoryId,
          },
        });
        newCount++;
      }
    }

    await this.prismaService.account.update({
      where: { id: account.id },
      data: {
        balance: statement.latestBalance,
        lastSyncedAt: new Date(),
      },
    });

    await this.contextBuilder.clearCache(userId);

    return {
      accountId: account.id,
      accountName: account.name || 'ПриватБанк Account',
      totalParsed: statement.transactions.length,
      newTransactions: newCount,
      updatedTransactions: updatedCount,
    };
  }
}
```

- [x] **Step 3: Commit**

```bash
git add apps/api/src/privatbank/privatbank.schema.ts apps/api/src/privatbank/privatbank.service.ts
git commit -m "feat(privatbank): add PrivatBank Zod schemas and service logic"
```

---

### Task 5: PrivatBank Controller & Module Integration

**Files:**
- Create: `apps/api/src/privatbank/privatbank.controller.ts`
- Create: `apps/api/src/privatbank/privatbank.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [x] **Step 1: Create `PrivatBankController`**

Create `apps/api/src/privatbank/privatbank.controller.ts`:
```ts
import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  InspectPrivatBankResponseDto,
  UploadPrivatBankResponseDto,
} from 'src/_generated/zod/pfd-dtos';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { PrivatBankService } from './privatbank.service';

@ApiTags('PrivatBank')
@Controller('api/privatbank')
export class PrivatBankController {
  constructor(private readonly privatBankService: PrivatBankService) {}

  @Post('inspect')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async inspectStatement(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<InspectPrivatBankResponseDto> {
    return await this.privatBankService.inspectStatement(userId, file.buffer);
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadStatement(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { accountId?: string; accountName?: string },
  ): Promise<UploadPrivatBankResponseDto> {
    return await this.privatBankService.uploadStatement(userId, file.buffer, body);
  }
}
```

- [x] **Step 2: Create `PrivatBankModule`**

Create `apps/api/src/privatbank/privatbank.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AiModule } from 'src/ai/ai.module';
import { PrivatBankController } from './privatbank.controller';
import { PrivatBankService } from './privatbank.service';
import { PrivatBankCategoryService } from './services/privatbank-category.service';
import { PrivatBankParserService } from './services/privatbank-parser.service';

@Module({
  imports: [AiModule],
  controllers: [PrivatBankController],
  providers: [PrivatBankService, PrivatBankParserService, PrivatBankCategoryService],
  exports: [PrivatBankService],
})
export class PrivatBankModule {}
```

- [x] **Step 3: Register `PrivatBankModule` in `AppModule`**

Edit `apps/api/src/app.module.ts` to import and register `PrivatBankModule`.

- [x] **Step 4: Commit**

```bash
git add apps/api/src/privatbank/ apps/api/src/app.module.ts
git commit -m "feat(privatbank): register PrivatBank controller and module"
```


---

### Task 6: Codegen Execution

**Files:**
- Run root codegen to update OpenAPI spec & generated web components/types.

- [x] **Step 1: Execute `bun run codegen`**

Run from root:
```bash
bun run codegen
```
Expected: `_generated/zod/pfd-dtos.ts`, OpenAPI spec, and `apps/web/src/_generated/api/pfd-components.ts` generated successfully without errors.

- [x] **Step 2: Commit generated code**

```bash
git add .
git commit -m "chore(codegen): update generated DTOs, OpenAPI spec, and web React Query hooks"
```

---

### Task 7: Frontend Upload Modal & Dashboard Integration

**Files:**
- Create: `apps/web/src/components/privatbank/PrivatBankUploadModal.tsx`
- Modify: `apps/web/src/components/dashboard/summary/AccountsSummary.tsx`
- Modify: `apps/web/src/locales/en.json` & `apps/web/src/locales/uk.json`

- [x] **Step 1: Add Translations**

Add to `apps/web/src/locales/en.json`:
```json
"privatbank": {
  "importButton": "Import Statement",
  "modalTitle": "Import PrivatBank Statement",
  "selectFile": "Drag and drop your .xlsx statement here",
  "fileSelected": "File loaded",
  "card": "Card:",
  "period": "Period:",
  "transactionsFound": "Transactions:",
  "useExistingAccount": "Import into existing account:",
  "createNewAccount": "Create new account:",
  "accountNameLabel": "Account name",
  "importing": "Importing...",
  "confirmImport": "Confirm & Import",
  "success": "{{newCount}} new transactions imported, {{updatedCount}} updated."
}
```

Add corresponding Ukrainian translations to `apps/web/src/locales/uk.json`.

- [x] **Step 2: Create `PrivatBankUploadModal` Component**

Create `apps/web/src/components/privatbank/PrivatBankUploadModal.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useInspectPrivatBank,
  useUploadPrivatBank,
} from '#src/_generated/api/pfd-components';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function PrivatBankUploadModal({ isOpen, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [useExisting, setUseExisting] = useState<boolean>(true);
  const [customName, setCustomName] = useState<string>('ПриватБанк - Картка для виплат');

  const { mutate: inspect, data: inspectData, isLoading: isInspecting } = useInspectPrivatBank();
  const { mutate: upload, isLoading: isUploading } = useUploadPrivatBank();

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    inspect({ body: { file: selected } as any });
  };

  const handleConfirm = () => {
    if (!file) return;
    upload(
      {
        body: {
          file,
          accountId: useExisting && inspectData?.matchedAccountId ? inspectData.matchedAccountId : undefined,
          accountName: !useExisting ? customName : undefined,
        } as any,
      },
      {
        onSuccess: () => {
          onSuccess();
          onClose();
        },
      },
    );
  };

  return (
    <div className={'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'}>
      <div className={'w-full max-w-md bg-card border border-border rounded-lg p-6 space-y-4 shadow-lg'}>
        <h2 className={'text-xl font-bold'}>{t('privatbank.modalTitle')}</h2>

        {!inspectData ? (
          <div className={'border-2 border-dashed border-border p-6 text-center rounded-lg cursor-pointer'}>
            <input type={'file'} accept={'.xlsx'} onChange={handleFileChange} className={'hidden'} id={'privat-xlsx-file'} />
            <label htmlFor={'privat-xlsx-file'} className={'cursor-pointer block'}>
              {isInspecting ? t('common.loading') : t('privatbank.selectFile')}
            </label>
          </div>
        ) : (
          <div className={'space-y-4'}>
            <div className={'p-3 bg-muted rounded text-sm space-y-1'}>
              <div><strong>{t('privatbank.card')}</strong> {inspectData.maskedPan}</div>
              <div><strong>{t('privatbank.transactionsFound')}</strong> {inspectData.totalTransactions}</div>
            </div>

            {inspectData.matchedAccountId && (
              <div className={'space-y-2'}>
                <label className={'flex items-center gap-2 cursor-pointer'}>
                  <input
                    type={'radio'}
                    name={'accountOption'}
                    checked={useExisting}
                    onChange={() => setUseExisting(true)}
                  />
                  <span>{t('privatbank.useExistingAccount')} {inspectData.matchedAccountName}</span>
                </label>
              </div>
            )}

            <div className={'space-y-2'}>
              <label className={'flex items-center gap-2 cursor-pointer'}>
                <input
                  type={'radio'}
                  name={'accountOption'}
                  checked={!useExisting || !inspectData.matchedAccountId}
                  onChange={() => setUseExisting(false)}
                />
                <span>{t('privatbank.createNewAccount')}</span>
              </label>

              {(!useExisting || !inspectData.matchedAccountId) && (
                <input
                  type={'text'}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className={'w-full p-2 border rounded bg-background text-foreground'}
                />
              )}
            </div>

            <div className={'flex justify-end gap-2 pt-2'}>
              <button type={'button'} onClick={onClose} className={'px-4 py-2 border rounded'}>
                {t('common.cancel')}
              </button>
              <button
                type={'button'}
                onClick={handleConfirm}
                disabled={isUploading}
                className={'px-4 py-2 bg-primary text-primary-foreground rounded font-medium'}
              >
                {isUploading ? t('privatbank.importing') : t('privatbank.confirmImport')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [x] **Step 3: Update `AccountsSummary.tsx` with Import Button & Bank Display**

Edit `apps/web/src/components/dashboard/summary/AccountsSummary.tsx`:
Add "Import" button to the header and render account `name` (if available) with bank badge.

- [x] **Step 4: Verify Frontend Lint & Build**

Run from root:
```bash
bun run lint && bun turbo build
```
Expected: Build passes with zero errors.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): add PrivatBank upload modal and update AccountsSummary"
```

---

### Task 8: End-to-End Verification & Sanity Test

- [ ] **Step 1: Test with reference statement `Y2H6sDPKT2ONjps3leJlDx1GrRTJflI7ig7bSUQEtik.xlsx`**

Run dev server or write integration script to inspect and upload the file. Verify:
- Account created or matched correctly.
- 286 transactions inserted with proper categories and negative kopiyka amounts.
- Re-uploading statement results in 0 new transactions and 286 updated.
- Accounts and latest transactions render PrivatBank data seamlessly.

- [ ] **Step 2: Commit final changes**

```bash
git commit --allow-empty -m "chore: verified privatbank statement import end-to-end"
```
