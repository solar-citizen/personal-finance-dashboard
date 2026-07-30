import { Currency } from 'src/_generated/prisma-client/enums';
import { isUnknownArray } from 'src/_lib/utils';

type NbuRateRow = {
  exchangedate: string;
  rate: number;
  units: number;
  rate_per_unit: number;
};

type CurrencyConfig = {
  currency: Currency;
  valcode: string;
};

export const currencyConfigs: CurrencyConfig[] = [
  { currency: Currency.usd, valcode: 'usd' },
  { currency: Currency.eur, valcode: 'eur' },
];

function isNbuRateRow(value: unknown): value is NbuRateRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    'exchangedate' in value &&
    typeof value.exchangedate === 'string' &&
    'units' in value &&
    typeof value.units === 'number' &&
    value.units !== 0 &&
    'rate' in value &&
    typeof value.rate === 'number'
  );
}

function parseNbuDate(exchangeDate: string): Date {
  const [day, month, year] = exchangeDate.split('.').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function mapNbuRateToHistoryEntry(
  { exchangedate, rate_per_unit }: NbuRateRow,
  currency: Currency,
) {
  return {
    date: parseNbuDate(exchangedate),
    currency,

    /**
     * Archive data before the Dec 2019 classifier change quotes `rate`
     * per `units` currency units (e.g. per 100), not per 1. rate_per_unit
     * is NBU's own already-normalized value, so we store that directly
     * instead of doing our own date-based guessing.
     */
    rateToUah: rate_per_unit.toString(),
  };
}

export async function fetchNbuRates(
  startDate: string,
  endDate: string,
  valcode: string,
): Promise<NbuRateRow[]> {
  const url = `https://bank.gov.ua/NBU_Exchange/exchange_site?start=${startDate}&end=${endDate}&valcode=${valcode}&sort=exchangedate&order=asc&json`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `NBU request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data: unknown = await response.json();

  if (!isUnknownArray(data) || !data.every(isNbuRateRow)) {
    throw new Error('Invalid NBU response format');
  }

  return data;
}
