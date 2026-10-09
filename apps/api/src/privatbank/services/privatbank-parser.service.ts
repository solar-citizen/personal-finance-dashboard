import * as crypto from 'node:crypto';
import { Readable } from 'node:stream';

import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { amountMinorUnits } from 'src/_lib/utils/currency.util';
import { parseDate } from 'src/_lib/utils/date.util';

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

    await workbook.xlsx.read(Readable.from(buffer));

    if (workbook.worksheets.length === 0) {
      throw new BadRequestException('The uploaded file is empty or invalid.');
    }

    const worksheet = workbook.worksheets[0];

    const transactions: ParsedPrivatTransaction[] = [];

    let detectedPan = '';
    let currency: 'uah' | 'usd' | 'eur' = 'uah';

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) {
        return;
      }

      const rawDate = this.getCellValue(row.getCell(1));
      const categoryName = this.getCellValue(row.getCell(2));
      const maskedPan = this.getCellValue(row.getCell(3));
      const description = this.getCellValue(row.getCell(4));
      const rawCardAmount = this.getCellValue(row.getCell(5));
      const cardCurrency = this.getCellValue(row.getCell(6)).toLowerCase();
      const rawTxAmount = this.getCellValue(row.getCell(7));
      const rawEndingBalance = this.getCellValue(row.getCell(9));

      if (!rawDate || !maskedPan || !rawCardAmount) {
        return;
      }

      if (!detectedPan) {
        detectedPan = maskedPan;
      }

      if (
        cardCurrency === 'usd' ||
        cardCurrency === 'eur' ||
        cardCurrency === 'uah'
      ) {
        currency = cardCurrency;
      }

      const time = parseDate(rawDate);
      const amount = amountMinorUnits(rawCardAmount);
      const opAmount = amountMinorUnits(rawTxAmount || rawCardAmount);
      const balance = amountMinorUnits(rawEndingBalance || '0');

      const externalId = crypto
        .createHash('sha256')
        .update(
          `${maskedPan}|${time.toISOString()}|${amount.toString()}|${description}|${balance.toString()}`,
        )
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
      throw new BadRequestException(
        'No valid transactions found in statement.',
      );
    }

    const sorted = [...transactions].sort(
      (a, b) => a.time.getTime() - b.time.getTime(),
    );

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
    const val = cell.value;

    if (val === null || val === undefined) {
      return '';
    }

    if (typeof val === 'string') {
      return val.trim();
    }

    if (typeof val === 'number' || typeof val === 'boolean') {
      return val.toString().trim();
    }

    if (typeof val === 'object' && 'result' in val) {
      const res = val.result;

      if (typeof res === 'string') {
        return res.trim();
      }

      if (typeof res === 'number' || typeof res === 'boolean') {
        return res.toString().trim();
      }
    }

    return '';
  }

  private currencyToNumericCode(code: string): number {
    switch (code.toLowerCase()) {
      case 'usd':
        return 840;
      case 'eur':
        return 978;
      case 'uah':
      default:
        return 980;
    }
  }
}
