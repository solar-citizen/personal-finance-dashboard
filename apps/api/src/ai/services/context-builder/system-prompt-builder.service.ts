import { Injectable } from '@nestjs/common';
import { accountTypeNames } from '@pfd/shared';
import { Currency } from 'src/_generated/prisma-client/enums';
import {
  amountToNumber,
  formatAmount,
  formatCurrency,
} from 'src/_lib/utils/currency.util';
import { formatValue } from 'src/_lib/utils/number.util';

import {
  identityInstructions,
  languageInstructions,
  nonFinancialInstructions,
} from '../_lib/system-prompt-commons';
import {
  KnowledgeBaseEntry,
  MatchingTransactionsResult,
  SystemPromptData,
} from './context-builder.types';

@Injectable()
export class SystemPromptBuilderService {
  createSystemPrompt({
    accounts,
    transactions,
    categories,
    knowledgeBase,
    exchangeRates,
    wasSampled,
    totalTransactionCount,
    dateRange,
    aggregates,
    matchingTransactions,
  }: SystemPromptData): string {
    const { usdToUah, eurToUah } = exchangeRates;
    const { from, to } = dateRange;

    const dateRangeLabel =
      totalTransactionCount > 0 ? `${from} to ${to}` : 'No recent transactions';

    const conversionRates: Record<Currency, number> = {
      [Currency.usd]: usdToUah,
      [Currency.eur]: eurToUah,
      [Currency.uah]: 1,
    };

    const formatted = accounts.map(({ balance, currency, type }) => {
      const amount = amountToNumber(balance);
      const amountInUah = amount * conversionRates[currency];
      const suffix =
        currency !== Currency.uah && amount !== 0
          ? ` = ${amountInUah.toFixed(2)} UAH`
          : '';

      return {
        line: `- ${accountTypeNames[type] || type} (${currency.toUpperCase()}): ${formatCurrency(balance, currency)}${suffix}`,
        amount: amountInUah,
      };
    });

    const allAccountsList = formatted.map(({ line }) => line).join('\n');
    const accountsSummary = formatted
      .filter(({ amount }) => amount !== 0)
      .map(({ line }) => line)
      .join('\n');

    const totalInUah = formatted.reduce((sum, { amount }) => sum + amount, 0);

    const { byCurrency, byCategory } = aggregates;

    const txSummary = byCurrency
      .map(
        ({ currency, count, total }) =>
          `- ${currency.toUpperCase()}: ${count} transactions, ${formatCurrency(total.toString(), currency)}`,
      )
      .join('\n');

    const categoryList = categories.map(({ name }) => name).join(', ');
    const topSpending = byCategory
      .map(({ category, total }) => `- ${category}: ${total.toFixed(2)}`)
      .join('\n');
    const knowledgeSection = this.formatKnowledgeSection(knowledgeBase);
    const matchingSection =
      this.formatMatchingTransactionsSection(matchingTransactions);

    return `
      === IDENTITY ===
      ${identityInstructions}

      === EXCHANGE RATES (CURRENT) ===
      1 USD = ${formatValue(conversionRates.usd)} UAH
      1 EUR = ${formatValue(conversionRates.eur)} UAH
      1 UAH = 1 UAH

      === CALCULATION RULES ===
      When calculating totals:
        1. Convert each account to UAH using rates above
        2. Sum all converted amounts
        3. Show your calculation steps

      Example:
        - 929.22 EUR × 48.78 UAH/EUR = 45,327.80 UAH
        - 329.88 UAH = 329.88 UAH
        Total: 45,327.80 + 329.88 = 45,657.68 UAH

      === FINANCIAL SUMMARY ===
      Total Balance: ${formatAmount(totalInUah, { decimals: 2, divisor: 1 })} UAH
      Accounts: ${accounts.length}
      Total Transactions (${dateRangeLabel}): ${totalTransactionCount}
      ${
        wasSampled
          ? `
              Note: all totals and breakdowns below are calculated from all 
              ${totalTransactionCount} transactions. Only ${transactions.length} representative 
              examples are listed individually below (sampled for importance) - do not treat 
              ${transactions.length} as the real count. If asked for a specific/complete list of
              individual transactions that isn't covered by the "EXACT MATCHES" section below,
              say the full list isn't available in this context rather than presenting the
              sampled examples as if they were complete.
            `
          : ''
      }
      ${matchingSection}

      Transactions by Currency:
      ${txSummary || 'No transactions'}

      Active Accounts:
      ${accountsSummary || 'No accounts with balance'}

      All Accounts:
      ${allAccountsList}

      Top Spending (${dateRangeLabel}):
      ${topSpending || 'No data'}

      Categories: ${categoryList}
      ${knowledgeSection}

      === CRITICAL RULES ===
      1. **TONE & STYLE**:
        - Be warm, polite, and conversational.
        - Write like a helpful human, not a robot.
        - Use natural language, avoid overly technical or formal tone.
        - Show empathy when discussing spending or finances.

      2. **CURRENCY CONVERSIONS**: You HAVE exchange rates above. When user asks about amounts in UAH/EUR/USD:
        - Use the rates provided
        - Don't ask for rates - YOU HAVE THEM.
        - Show calculations clearly
        - Example: "1,000 UAH ÷ ${formatAmount(eurToUah, { decimals: 2, divisor: 1 })} = X EUR"

      3. **TRANSACTION DATA**: You have FULL transaction data with currency info. When asked about spending by currency:
        - Analyze transactions from "Transactions by Currency" section
        - Show amounts per currency
        - Don't say "I don't have this data" - YOU HAVE IT.

      4. **LANGUAGE**: ${languageInstructions}

      5. **ACCOUNTS DISPLAY**:
        - By default show only non-zero accounts
        - Show all accounts only if explicitly asked
        - Use translated names (Чорна, Біла, єПідтримка), not technical names

      6. **NON-FINANCIAL QUESTIONS**: ${nonFinancialInstructions}

      7. **FORMATTING**: Be concise, no unnecessary explanations, direct answers with data

      === EXAMPLES ===
      ❌ BAD: "I don't have currency data for transactions"
      ✅ GOOD: "EUR spending: 150.50 EUR (see Transactions by Currency section)"

      ❌ BAD: "Please provide exchange rate"
      ✅ GOOD: "Using rate 1 EUR = ${formatAmount(eurToUah, { decimals: 2, divisor: 1 })} UAH: 5,000 UAH = 102.50 EUR"

      ❌ BAD: "Data shows: EUR=500, USD=200"
      ✅ GOOD: "You spent 500 EUR and 200 USD this month. Would you like to see this converted to UAH?"

      Remember: You have ALL data needed. Be confident, precise, helpful, and most importantly - human!`;
  }

  createMinimalSystemPrompt(): string {
    return `
      **IDENTITY**: ${identityInstructions}
      **NON-FINANCIAL QUESTIONS**: ${nonFinancialInstructions}
      **LANGUAGE**: ${languageInstructions}
    `;
  }

  private formatKnowledgeSection(knowledgeBase: KnowledgeBaseEntry[]): string {
    if (knowledgeBase.length === 0) {
      return '';
    }

    const entries = knowledgeBase
      .map(({ content, similarity }, index) => {
        const relevancePercent = (similarity * 100).toFixed(0);
        return `${index + 1}. ${content} (relevance: ${relevancePercent}%)`;
      })
      .join('\n');

    return `\n\nRelevant Information:\n${entries}`;
  }

  private formatMatchingTransactionsSection(
    matchingTransactions: MatchingTransactionsResult | null,
  ): string {
    if (!matchingTransactions) {
      return '';
    }

    const { categoryName, transactions, truncated } = matchingTransactions;

    if (transactions.length === 0) {
      return `\n\n=== EXACT MATCHES: ${categoryName} ===\nNo transactions found in this category for the period.\n`;
    }

    const lines = transactions
      .map(({ time, description, amount, account }) => {
        const dateStr = time.toISOString().slice(0, 10);
        return `- ${dateStr}: ${description} — ${formatCurrency(amount, account.currency)}`;
      })
      .join('\n');

    const completenessNote = truncated
      ? `This list is TRUNCATED at ${transactions.length} rows - more exist than shown. If asked for the full list, say so rather than presenting this as complete.`
      : `This is the COMPLETE list for "${categoryName}" in this period - all ${transactions.length} matching transactions, none omitted.`;

    return `\n\n=== EXACT MATCHES: ${categoryName} ===\n${completenessNote}\n${lines}\n`;
  }
}
