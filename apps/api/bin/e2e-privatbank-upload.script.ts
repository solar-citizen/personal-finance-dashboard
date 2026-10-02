/**
 * E2E sanity script for PrivatBank XLSX upload.
 *
 * Usage:
 *   cd apps/api && bun run bin/e2e-privatbank-upload.script.ts
 *   or from root:
 *   bun run apps/api/bin/e2e-privatbank-upload.script.ts
 *
 * Requires:
 *   - API running on localhost:4000
 *   - Reference XLSX at project root
 *   - A valid user (admin@pfd.ua / see .env)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { z } from 'zod';

import {
  AuthResponseSchema,
  InspectPrivatBankResponseSchema,
  MonoBankAccountResponseSchema,
  TransactionResponseSchema,
  UploadPrivatBankResponseSchema,
} from '../../../_generated/zod/pfd-schemas';
import { prisma } from '../prisma/client';

const BASE_URL = process.env.API_URL ?? 'http://localhost:4000';
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@pfd.ua';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';

const currentDir = path.dirname(new URL(import.meta.url).pathname);

const possiblePaths = [
  path.resolve(currentDir, '../test/fixtures/privatbank-statement.xlsx'),
  path.resolve(process.cwd(), 'test/fixtures/privatbank-statement.xlsx'),
  path.resolve(
    process.cwd(),
    'apps/api/test/fixtures/privatbank-statement.xlsx',
  ),
];
const XLSX_PATH =
  possiblePaths.find((p) => fs.existsSync(p)) ?? possiblePaths[0];

function ok(label: string) {
  console.log(`  ✓ ${label}`);
}

function fail(label: string, detail?: unknown): never {
  console.error(`  ✗ ${label}`, detail ?? '');
  process.exit(1);
}

async function cleanupPreviousTestData(userId: string) {
  const deleted = await prisma.account.deleteMany({
    where: {
      userId,
      maskedPan: '4149 **** **** 8602',
    },
  });

  if (deleted.count > 0) {
    ok(`Cleaned up ${deleted.count.toString()} previous test account(s)`);
  }
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (res.ok) {
    const raw: unknown = await res.json();
    const data = AuthResponseSchema.parse(raw);
    ok(`Logged in as ${EMAIL}`);

    return data.accessToken;
  }

  // Attempt auto-registration if login failed
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      name: 'Admin',
    }),
  });

  if (regRes.ok) {
    const raw: unknown = await regRes.json();
    const regData = AuthResponseSchema.parse(raw);
    ok(`Registered and logged in as ${EMAIL}`);

    return regData.accessToken;
  }

  const body = await res.text();
  fail(`Login failed (${res.status.toString()})`, body);
}

async function inspect(token: string) {
  if (!fs.existsSync(XLSX_PATH)) {
    fail(`Reference statement not found at ${XLSX_PATH}`);
  }

  const form = new FormData();
  const file = new File([fs.readFileSync(XLSX_PATH)], 'statement.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  form.append('file', file);

  const res = await fetch(`${BASE_URL}/api/privatbank/inspect`, {
    method: 'POST',
    headers: {
      Cookie: `token=${token}`,
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    fail(`Inspect failed (${res.status.toString()})`, body);
  }

  const raw: unknown = await res.json();
  const data = InspectPrivatBankResponseSchema.parse(raw);

  ok(
    `Inspect: maskedPan=${data.maskedPan}, totalTransactions=${data.totalTransactions.toString()}, matchedAccountId=${data.matchedAccountId ?? 'none'}`,
  );

  return data;
}

async function upload(
  token: string,
  opts: { accountId?: string; accountName?: string },
) {
  if (!fs.existsSync(XLSX_PATH)) {
    fail(`Reference statement not found at ${XLSX_PATH}`);
  }

  const form = new FormData();
  const file = new File([fs.readFileSync(XLSX_PATH)], 'statement.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  form.append('file', file);

  if (opts.accountId) {
    form.append('accountId', opts.accountId);
  }

  if (opts.accountName) {
    form.append('accountName', opts.accountName);
  }

  const res = await fetch(`${BASE_URL}/api/privatbank/upload`, {
    method: 'POST',
    headers: {
      Cookie: `token=${token}`,
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    fail(`Upload failed (${res.status.toString()})`, body);
  }

  const raw: unknown = await res.json();
  const data = UploadPrivatBankResponseSchema.parse(raw);

  ok(
    `Upload: accountId=${data.accountId}, new=${data.newTransactions.toString()}, updated=${data.updatedTransactions.toString()}, total=${data.totalParsed.toString()}`,
  );

  return data;
}

async function verifyAccounts(token: string, expectedAccountId: string) {
  const res = await fetch(`${BASE_URL}/api/mono/accounts`, {
    headers: {
      Cookie: `token=${token}`,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    fail(`Fetch accounts failed (${res.status.toString()})`, body);
  }

  const raw: unknown = await res.json();
  const accounts = z.array(MonoBankAccountResponseSchema).parse(raw);
  const account = accounts.find((a) => a.id === expectedAccountId);

  if (!account) {
    fail(`Account ${expectedAccountId} not found in accounts list`);
  }

  if (account.bank !== 'privatbank') {
    fail(`Expected bank 'privatbank', got '${account.bank ?? 'none'}'`);
  }

  if (account.maskedPan !== '4149 **** **** 8602') {
    fail(
      `Expected maskedPan '4149 **** **** 8602', got '${account.maskedPan ?? 'none'}'`,
    );
  }

  ok(
    `Accounts integration: found ${account.name ?? 'Account'} (${account.bank}) balance=${account.balance} UAH`,
  );

  return account;
}

async function verifyTransactions(token: string, expectedCount: number) {
  const res = await fetch(`${BASE_URL}/api/mono/transactions?limit=300`, {
    headers: {
      Cookie: `token=${token}`,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    fail(`Fetch transactions failed (${res.status.toString()})`, body);
  }

  const raw: unknown = await res.json();
  const transactions = z.array(TransactionResponseSchema).parse(raw);

  if (transactions.length < expectedCount) {
    fail(
      `Expected at least ${expectedCount.toString()} transactions, received ${transactions.length.toString()}`,
    );
  }

  // Verify that expenses have negative amounts
  const negativeExpense = transactions.find((t) => t.amount < 0);

  if (!negativeExpense) {
    fail('Expected at least one transaction with negative amount');
  }

  // Verify category matching
  const categorized = transactions.filter((t) => t.category !== null);

  if (categorized.length === 0) {
    fail('Expected at least one transaction with resolved category');
  }

  ok(
    `Transactions integration: fetched ${transactions.length.toString()} transactions, ${categorized.length.toString()} categorized, expenses verified negative`,
  );

  return transactions;
}

async function main() {
  console.log('\n=== PrivatBank XLSX E2E Sanity Test ===\n');

  try {
    // 1. Login
    const token = await login();

    // 2. Identify user and clean up prior test data for idempotency
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });

    if (user) {
      await cleanupPreviousTestData(user.id);
    }

    // 3. Inspect before upload (should have no matched account)
    console.log('\n[Step 1] Inspect statement before upload');
    const inspectBefore = await inspect(token);

    if (inspectBefore.totalTransactions !== 286) {
      fail(
        `Expected exactly 286 transactions in reference statement, got ${inspectBefore.totalTransactions.toString()}`,
      );
    }

    if (inspectBefore.matchedAccountId !== null) {
      fail(
        `Expected matchedAccountId to be null before upload, got ${inspectBefore.matchedAccountId}`,
      );
    }
    ok('Initial inspect verified: 286 transactions, no matched account ✓');

    // 4. First upload — create account + insert all 286 transactions
    console.log('\n[Step 2] First upload (create account + insert all)');
    const firstUpload = await upload(token, {
      accountName: 'E2E Test PrivatBank Card',
    });

    if (firstUpload.totalParsed !== 286) {
      fail(
        `Expected 286 totalParsed, got ${firstUpload.totalParsed.toString()}`,
      );
    }

    if (firstUpload.newTransactions !== 286) {
      fail(
        `Expected 286 new transactions, got ${firstUpload.newTransactions.toString()}`,
      );
    }

    if (firstUpload.updatedTransactions !== 0) {
      fail(
        `Expected 0 updated transactions, got ${firstUpload.updatedTransactions.toString()}`,
      );
    }
    ok('All 286 transactions inserted as new ✓');

    // 5. Inspect after upload — should match the created account
    console.log('\n[Step 3] Inspect statement after upload (match check)');
    const inspectAfter = await inspect(token);

    if (inspectAfter.matchedAccountId !== firstUpload.accountId) {
      fail(
        `Expected matchedAccountId ${firstUpload.accountId}, got ${inspectAfter.matchedAccountId ?? 'null'}`,
      );
    }
    ok(
      `Account matched correctly: ${inspectAfter.matchedAccountName ?? ''} (${inspectAfter.matchedAccountId}) ✓`,
    );

    // 6. Second upload — re-upload deduplication check
    console.log('\n[Step 4] Re-upload (deduplication check)');
    const secondUpload = await upload(token, {
      accountId: firstUpload.accountId,
    });

    if (secondUpload.newTransactions !== 0) {
      fail(
        `Expected 0 new transactions on re-upload, got ${secondUpload.newTransactions.toString()}`,
      );
    }

    if (secondUpload.updatedTransactions !== 286) {
      fail(
        `Expected 286 updated transactions on re-upload, got ${secondUpload.updatedTransactions.toString()}`,
      );
    }
    ok('0 new, 286 updated — deduplication works ✓');

    // 7. Verify account display in accounts summary
    console.log('\n[Step 5] Verify account display (/api/mono/accounts)');
    await verifyAccounts(token, firstUpload.accountId);

    // 8. Verify transactions display in transactions list
    console.log(
      '\n[Step 6] Verify transactions display (/api/mono/transactions)',
    );
    await verifyTransactions(token, 286);

    console.log('\n=== All E2E checks passed successfully ✓ ===\n');
  } finally {
    await prisma.$disconnect();
  }
}

await main();
