// cSpell:disable

/**
 * Keyword heuristic for "this looks like a request for a specific/full
 * list of transactions" as opposed to a broad summary question. This is
 * deliberately conservative and cheap - it doesn't need to be a full NLU
 * pass. False negatives just mean the user gets the existing
 * sampled-example behavior (no worse than before this feature existed).
 * False positives just cost one extra, cheap, filtered DB query.
 */

export const listRequestPattern =
  /\b(list|show (me )?(all|every)|which transactions|find (all|every))\b|((всі|усі)[а-яіїєґ']*\s*транзакці|транзакці[а-яіїєґ']*\s*(всі|усі)|список\s*транзакці|скільки.*транзакці)/i;

export const fullCategoryBreakdownPattern =
  /\b(show all categories|full category breakdown|breakdown by (all )?categor)\b|((всі|усі)[а-яіїєґ']*\s*катего|повн[а-яіїєґ']*\s*(список|перелік|розбивк)|розбий\s*(усі|всі))/i;

export const breakdownConfirmationPattern =
  /^(так|да|yes|ok|okay|kay|ofc|ofcourse|окей|давай|добре|sure)[.!]?$/i;
