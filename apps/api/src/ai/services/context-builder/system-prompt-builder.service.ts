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
  contextAwarenessInstructions,
  identityInstructions,
  languageInstructions,
  nonFinancialInstructions,
} from '../_lib/system-prompt-commons';
import type {
  CategoryBreakdown,
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
    isFullCategoryBreakdownRequested,
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

    const {
      byCurrency,
      byCategory,
      topCategories,
      otherCategoriesCount,
      otherCategoriesOutgoing,
      otherCategoriesIncoming,
      totalCashOut,
      totalCashIn,
      byOperationCurrency,
    } = aggregates;

    const txSummary = byCurrency
      .map(
        ({
          currency,
          count,
          total,
          incoming,
          outgoing,
          totalInUah,
          incomingInUah,
          outgoingInUah,
        }) => {
          const isUah = currency === Currency.uah;
          const totalLine =
            `- ${currency.toUpperCase()}: ${count} transactions, total ${formatCurrency(total.toString(), currency, { divisor: 1 })}` +
            (isUah || totalInUah === total
              ? ''
              : ` (≈ ${formatValue(totalInUah)} UAH using historical daily NBU rates)`);

          const incomingLine =
            `  Incoming: ${formatCurrency(incoming.toString(), currency, { divisor: 1 })}` +
            (isUah ? '' : ` (≈ ${formatValue(incomingInUah)} UAH)`);

          const outgoingLine =
            `  Outgoing: ${formatCurrency(outgoing.toString(), currency, { divisor: 1 })}` +
            (isUah ? '' : ` (≈ ${formatValue(outgoingInUah)} UAH)`);

          return [totalLine, incomingLine, outgoingLine].join('\n');
        },
      )
      .join('\n');

    const categoryList = categories.map(({ name }) => name).join(', ');
    const topSpending = topCategories
      .map(
        ({ category, incoming, outgoing }) =>
          `- ${category}: Incoming ${formatValue(incoming)}, Outgoing ${formatValue(outgoing)}`,
      )
      .join('\n');

    const otherCategoriesNote =
      otherCategoriesCount > 0
        ? `\n- Other categories (${otherCategoriesCount}, aggregate only): Outgoing ${formatValue(otherCategoriesOutgoing)}, Incoming ${formatValue(otherCategoriesIncoming)}.
          A full per-category breakdown of these ${otherCategoriesCount} categories CAN be fetched if the user asks for it (e.g. "show all categories" / "покажи всі категорії").`
        : '';

    const knowledgeSection = this.formatKnowledgeSection(knowledgeBase);
    const matchingSection =
      this.formatMatchingTransactionsSection(matchingTransactions);

    const fullCategoryBreakdownSection =
      this.formatFullCategoryBreakdownSection(
        byCategory,
        isFullCategoryBreakdownRequested,
      );

    const topSpendingBlock = isFullCategoryBreakdownRequested
      ? ''
      : this.buildTopSpendingBlock(topSpending, otherCategoriesNote);

    return `
      === IDENTITY ===
      ${identityInstructions}

      === EXCHANGE RATES (CURRENT & HISTORICAL) ===
      Current rates (for reference or current account balances):
      1 USD = ${formatValue(conversionRates.usd)} UAH
      1 EUR = ${formatValue(conversionRates.eur)} UAH
      1 UAH = 1 UAH

      **CRITICAL HISTORICAL CONVERSION RULE**:
      For historical transactions (past spending/income in foreign currencies like USD or EUR), 
      ALWAYS use the exact historical NBU exchange rate on each transaction's specific date from 
      the Exchange Rate History (already factored into the Financial Summary and category totals above), 
      NOT the current exchange rate. When discussing historical foreign currency transactions, state 
      the historical rate applied on that date.

      === CALCULATION RULES ===
      When calculating totals:
        1. For current account balances, convert to UAH using current rates above.
        2. For historical transactions and periods, use the pre-calculated UAH conversions based on exact historical transaction dates.
        3. Show your calculation steps.

      Example:
        - 929.22 EUR × 48.78 UAH/EUR = 45,327.80 UAH
        - 329.88 UAH = 329.88 UAH
        Total: 45,327.80 + 329.88 = 45,657.68 UAH

      === FINANCIAL SUMMARY ===
      Total Cash Out (Expenses & Outgoing): ${formatValue(totalCashOut)} UAH
      Total Cash In (Income & Incoming): ${formatValue(totalCashIn)} UAH
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
      ${fullCategoryBreakdownSection}

      === FOREIGN CURRENCY TURNOVER & TRANSACTIONS BY CURRENCY ===
      CRITICAL: When a user asks about monetary turnover, volume, spending, or income in a specific foreign currency (EUR, USD):
      - NEVER claim the data is missing or unavailable WHEN IT'S AVAILABLE — the exact breakdown IS below.
      - Quote the exact "Incoming" and "Outgoing" numbers from the entry for that currency.
      - Provide both the raw foreign-currency amount and the historical UAH equivalent.
      - Do NOT refer the user to the UAH-only "Total Cash Out/In" for currency-specific questions.
      - Do NOT ask for clarification — report the numbers directly.

      Transactions by Currency (incoming/outgoing in original currency + historical UAH equivalent):
      ${txSummary || 'No transactions'}

      Active Accounts:
      ${accountsSummary || 'No accounts with balance'}

      All Accounts:
      ${allAccountsList}

      Top Spending (${dateRangeLabel}):
      ${topSpendingBlock || (isFullCategoryBreakdownRequested ? 'See FULL CATEGORY BREAKDOWN above.' : 'No data')}

      Categories: ${categoryList}
      ${knowledgeSection}

      === OPERATIONAL CURRENCY ANALYTICS (CROSS-CURRENCY TRANSACTIONS) ===
      These are transactions made using a foreign currency on a domestic (UAH) account.
      The amounts below are in the ORIGINAL operation currency — NOT in UAH.
      For balance/cashflow purposes these are already counted in the UAH ledger above.

      ${
        byOperationCurrency.length > 0
          ? byOperationCurrency
              .map(
                ({
                  currencyName,
                  incoming,
                  outgoing,
                  incomingInAccountCurrency,
                  outgoingInAccountCurrency,
                  count,
                }) =>
                  `- ${currencyName.toUpperCase()}: ${count} operations
                    Incoming: ${formatCurrency(incoming.toString(), currencyName.toLowerCase(), { divisor: 1 })} (≈ ${formatValue(incomingInAccountCurrency ?? 0)} UAH billed)
                    Outgoing: ${formatCurrency(outgoing.toString(), currencyName.toLowerCase(), { divisor: 1 })} (≈ ${formatValue(outgoingInAccountCurrency ?? 0)} UAH billed)`,
              )
              .join('\n')
          : 'No cross-currency operations in this period.'
      }

      === CRITICAL RULES ===
      1. **TONE & STYLE**:
        - Be warm, polite, and conversational.
        - Write like a helpful human, not a robot.
        - Use natural language, avoid overly technical or formal tone.
        - Show empathy when discussing spending or finances.

      2. **CONTEXT AWARENESS**:
        - If the user asks a follow-up question (like "break this down by category") but the date 
          range in the "FINANCIAL SUMMARY" clearly doesn't match the previous conversation context 
          (e.g., it unexpectedly reset to a 1-month default instead of the previously discussed 5 years), 
          explicitly state the period you are currently looking at.
        - Example: ${contextAwarenessInstructions.uk} (Ukrainian), ${contextAwarenessInstructions.en} (English)

      3. **CURRENCY CONVERSIONS**: You HAVE exchange rates above. When user asks about amounts in UAH/EUR/USD:
        - Use the rates provided
        - Don't ask for rates - YOU HAVE THEM.
        - Show calculations clearly
        - Example: "1,000 UAH ÷ ${formatAmount(eurToUah, { decimals: 2, divisor: 1 })} = X EUR"

      4. **TRANSACTION DATA**: You have FULL transaction data with currency info. When asked about spending by currency:
        - Analyze transactions from "Transactions by Currency" section
        - Show amounts per currency
        - Don't say "I don't have this data" - YOU HAVE IT.

      5. **LANGUAGE**: ${languageInstructions}

      6. **ACCOUNTS DISPLAY**:
        - By default show only non-zero accounts
        - Show all accounts only if explicitly asked
        - Use translated names (Чорна, Біла, єПідтримка), not technical names

      7. **NON-FINANCIAL QUESTIONS**: ${nonFinancialInstructions}

      8. **FORMATTING**: Be concise, no unnecessary explanations, direct answers with data

      9. NEVER attempt to calculate total sums manually from the transaction list.
      10. ALWAYS use the exact \`Total Cash Out\` and \`Total Cash In\` values provided in the FINANCIAL SUMMARY above.
      11. The "Cash Out" metric already includes all actual spending and outgoing money transfers.

      12. **HISTORICAL EXCHANGE RATES FOR TRANSACTIONS**:
        - For past spending/income in foreign currencies (USD, EUR), ALWAYS use the exact historical NBU exchange rate on 
          each transaction's date from the Exchange Rate History (already applied in the financial summaries above).
        - NEVER use the current exchange rate for past transactions.
        - Example: "On 15.03.2025, you spent 100 EUR. Using the historical rate of 43.50 UAH/EUR for that date, it equals 4,350.00 UAH."

      13. **DATA TRUTH & USER CONTRADICTIONS**:
        - The transaction data, totals, and aggregates provided to you in this prompt are the absolute ground truth.
        - If a user claims a transaction occurred that is not in your data, or claims an amount/date is different, DO NOT apologize and DO NOT agree with them.
        - Politely but firmly state that according to the system's exact records, the transaction does not exist or the data is different.
        - NEVER hallucinate or "find" fake transactions just because the user insists they exist.

      14. **CROSS-CURRENCY TRANSACTIONS**:
        - When asked "Were there EUR/USD transactions?" or "How much did I spend in EUR?",
          check BOTH "FOREIGN CURRENCY TURNOVER" (direct foreign-account transactions)
          AND "OPERATIONAL CURRENCY ANALYTICS" (cross-currency ops on UAH account).
        - If EUR appears in operational analytics but not in the account ledger, explain:
          "You did not have any direct charges from euro cards, but you did make operations
          totaling {X} EUR that were charged to your UAH card (amounting to {Y} UAH)."
        - NEVER say "no EUR transactions" if EUR appears in the operational analytics section.

      === EXAMPLES ===
      ❌ BAD: "I don't have currency data for transactions"
      ✅ GOOD: "EUR spending: 150.50 EUR (see Transactions by Currency section)"

      ❌ BAD: "Please provide exchange rate"
      ✅ GOOD: "Using rate 1 EUR = ${formatAmount(eurToUah, { decimals: 2, divisor: 1 })} UAH: 5,000 UAH = 102.50 EUR"

      ❌ BAD: "Data shows: EUR=500, USD=200"
      ✅ GOOD: "You spent 500 EUR and 200 USD this month. Would you like to see this converted to UAH?"

      ❌ BAD: "Sorry, you're right. There really was a transfer of 100 EUR." (When the data doesn't show it)
      ✅ GOOD: "According to my records, no transaction of 100 EUR on that date is recorded. All operations were only in UAH."

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

  private buildTopSpendingBlock(
    topSpending: string,
    otherCategoriesNote: string,
  ): string {
    if (topSpending) {
      return `${topSpending}${otherCategoriesNote}`;
    }

    return otherCategoriesNote
      ? `No top-category data.${otherCategoriesNote}`
      : 'No data';
  }

  private formatFullCategoryBreakdownSection(
    byCategory: CategoryBreakdown,
    requested: boolean,
  ): string {
    if (!requested) {
      return '';
    }

    const lines = byCategory
      .map(
        ({ category, incoming, outgoing }) =>
          `- ${category}: Incoming ${formatValue(incoming)}, Outgoing ${formatValue(outgoing)}`,
      )
      .join('\n');

    return `\n\n=== FULL CATEGORY BREAKDOWN (all ${byCategory.length} categories) ===\nThis is the COMPLETE list, none omitted.\n${lines}\n`;
  }
}
