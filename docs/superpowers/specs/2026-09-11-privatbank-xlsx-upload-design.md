# PrivatBank XLSX Upload & Account Blending Specification

## 1. Overview & Goals

This feature enables users to upload PrivatBank `.xlsx` account statements, parses and normalizes transaction data into our unified database schema, avoids duplicate records through deterministic deduplication, allows users to associate the upload with an existing account or create a new one (with customizable naming), and seamlessly blends PrivatBank data with existing Monobank data across the dashboard, analytics, and AI query services.

---

## 2. Requirements & Key Decisions

1. **File Format:**
   - Exclusively `.xlsx` statements exported from PrivatBank.
   - Parses row headers, date strings, masked card PAN, amounts, categories, and balances.
2. **Account Identification & Management:**
   - Extends the `Account` model to support multiple banks (`monobank`, `privatbank`).
   - Supports custom `name` (e.g., `"ПриватБанк - Картка для виплат"`) and `maskedPan` (e.g., `"4149 **** **** 8602"`).
   - If a PrivatBank account with the extracted `maskedPan` already exists for the user, the UI pre-selects it while allowing the user to select another account or create a new one.
   - When creating a new account, the name defaults to `"ПриватБанк - Картка для виплат"` (prefix `"ПриватБанк - "` is default, suffix is user-editable).
3. **Deduplication Strategy:**
   - Computes a deterministic SHA-256 hash for each transaction:
     `externalId = hash(maskedPan + timestamp + amount + description + balance)`
   - Relies on Prisma's composite unique constraint `@@unique([accountId, externalId])` to perform idempotent upserts without creating duplicates.
4. **Category Normalization:**
   - `Transaction.mcc` is made optional (`Int?`) since PrivatBank statements supply textual category names rather than MCC integers.
   - Matches PrivatBank category names directly against existing `Category` records in the database, falling back to keyword heuristics or the default `"Інше"` category.
5. **Unified Dashboard & Analytics Blending:**
   - Both Monobank and PrivatBank transactions are linked to user accounts and seamlessly aggregated in all dashboard views (Cash Flow Trend, Expense Breakdown, Highest Expenses, Latest Transactions, and AI Context Builder).
   - The UI distinguishes accounts with bank badges and displays custom account names alongside standard Monobank card types.

---

## 3. Database Schema Changes (`apps/api/prisma/schema.prisma`)

```prisma
enum Bank {
  monobank
  privatbank
}

model Account {
  id          String       @id @default(cuid())
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Bank identifier & custom naming
  bank        Bank         @default(monobank)
  name        String?      // e.g. "ПриватБанк - Картка для виплат"
  maskedPan   String?      // e.g. "4149 **** **** 8602"

  // Provider specific account ID
  accountId   String
  iban        String?
  type        AccountType? // Optional for non-Monobank accounts
  currency    Currency     @default(uah)
  balance     BigInt       // in minimal units (kopiykas)
  creditLimit BigInt       @default(0)
  
  // Sync metadata
  monoToken    String?
  lastSyncedAt DateTime?

  syncJobs     SyncJob[]
  transactions Transaction[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([userId, accountId])
  @@index([userId])
}

model Transaction {
  id         String   @id @default(cuid())
  accountId  String
  account    Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  
  externalId  String
  time        DateTime
  description String
  
  mcc         Int?     // Made optional for statement imports
  originalMcc Int?
  hold        Boolean  @default(false)
  
  amount            BigInt
  operationAmount   BigInt
  currencyCode      Int    // e.g. 980 for UAH
  
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

---

## 4. Backend Implementation (`apps/api`)

### 4.1. Module Structure
A new module `apps/api/src/privatbank/`:
- `privatbank.module.ts`: Registers `PrivatBankController`, `PrivatBankService`, `PrivatBankParserService`.
- `privatbank.schema.ts`: Zod schemas for inspection and upload DTOs.
- `privatbank.controller.ts`: API endpoints.
- `privatbank.service.ts`: Business logic for account resolution and transaction upserting.
- `services/privatbank-parser.service.ts`: Parser logic using `exceljs`.

### 4.2. Endpoints & DTOs
1. **`POST /api/privatbank/inspect`**
   - **Input:** Multipart file (`file`: `.xlsx` buffer).
   - **Response (`InspectPrivatBankResponseDto`):**
     ```ts
     {
       maskedPan: string;
       periodFrom: string;
       periodTo: string;
       totalTransactions: number;
       currency: Currency;
       matchedAccountId: string | null;
       matchedAccountName: string | null;
     }
     ```
2. **`POST /api/privatbank/upload`**
   - **Input:** Multipart form data (`file`, optional `accountId`, optional `accountName`).
   - **Response (`UploadPrivatBankResponseDto`):**
     ```ts
     {
       accountId: string;
       accountName: string;
       totalParsed: number;
       newTransactions: number;
       updatedTransactions: number;
     }
     ```
   - **Behavior:**
     - Creates new PrivatBank `Account` if `accountId` is not provided (using `accountName` or default `"ПриватБанк - Картка для виплат"`).
     - Deterministically maps rows, matches categories, and upserts transactions.
     - Updates account `balance` to match the latest transaction's ending balance.
     - Sets `lastSyncedAt` to current timestamp.
     - Invalidates AI context cache (`contextBuilder.clearCache(userId)`).

---

## 5. Frontend Implementation (`apps/web`)

### 5.1. UI Components
1. **`AccountsSummary.tsx`:**
   - Adds an **"Import Statement"** button in the header.
   - Renders bank badge / icon and displays `account.name` (for PrivatBank) or card type name (for Monobank).
2. **`PrivatBankUploadModal.tsx`:**
   - 2-Step modal wizard:
     - **Step 1:** File dropzone for `.xlsx` statement, triggers `useInspectPrivatBank`.
     - **Step 2:** File overview (card masked PAN, date range, count) + Account picker (radio button to use matched account or create new account with editable name).
     - Triggers `useUploadPrivatBank` on confirmation.
   - Shows progress and invalidates React Query keys (`accounts`, `latestTransactions`, `cashFlow`, `highestExpenses`).

### 5.2. Localization
Adds translation keys in `apps/web/src/locales/en.json` and `apps/web/src/locales/uk.json`:
- `privatbank.uploadTitle`
- `privatbank.dropzoneText`
- `privatbank.matchedAccountPrompt`
- `privatbank.createNewAccount`
- `privatbank.cardPrefix`
- `privatbank.defaultCardSuffix`
- `privatbank.uploadSuccess`
- `privatbank.uploadError`

---

## 6. Verification & Testing

1. **Parser Unit Testing:** Test parsing `Y2H6sDPKT2ONjps3leJlDx1GrRTJflI7ig7bSUQEtik.xlsx` for correct row count, date parsing, amounts, categories, and deduplication hashes.
2. **Idempotency Verification:** Uploading the same file twice results in 0 new transactions and 100% updated/unchanged transactions.
3. **Dashboard Blending Verification:** Verify that both Monobank and PrivatBank accounts display properly in `AccountsSummary`, cash flow charts, expense donuts, and latest transactions.
4. **Typecheck & Codegen:** Run `bun run codegen` and `bun turbo build` to ensure strict TypeScript and OpenAPI contracts pass without errors.
