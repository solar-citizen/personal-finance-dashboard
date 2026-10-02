import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'bun:test';

import { PrivatBankParserService } from './privatbank-parser.service';

describe('PrivatBankParserService', () => {
  const service = new PrivatBankParserService();
  const possiblePaths = [
    path.resolve(__dirname, '../../../test/fixtures/privatbank-statement.xlsx'),
    path.resolve(process.cwd(), 'test/fixtures/privatbank-statement.xlsx'),
    path.resolve(
      process.cwd(),
      'apps/api/test/fixtures/privatbank-statement.xlsx',
    ),
  ];
  const sampleFilePath =
    possiblePaths.find((p) => fs.existsSync(p)) ?? possiblePaths[0];

  it('should correctly parse the reference PrivatBank statement', async () => {
    const fileBuffer = fs.readFileSync(sampleFilePath);
    const parsed = await service.parseXlsx(fileBuffer);

    expect(parsed.maskedPan).toBe('4149 **** **** 8602');
    expect(parsed.currency).toBe('uah');
    expect(parsed.transactions.length).toBeGreaterThan(0);

    const firstTx = parsed.transactions[0];

    expect(firstTx.maskedPan).toBe('4149 **** **** 8602');
    expect(firstTx.amount < 0n).toBe(true);
    expect(firstTx.externalId).toBeDefined();
    expect(firstTx.externalId.length).toBe(64);
  });
});
