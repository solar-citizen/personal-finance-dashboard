// cSpell:disable

// Analytical queries - prefer Gemini
export const analyticalFinancePatterns = [
  // Ukrainian patterns - Analysis & Comparison
  /аналіз|порівня|тренд|статистик|динамік|прогноз|звіт/i,
  /де я можу заощадити|скільки витратив|найбільше витрат/i,
  /порада|рекомендац|бюджет|планування/i,
  /скільки залишилось|баланс|залишок|лишилось/i,
  /середн|загальн|сум|підсумок/i,
  /зріст|зростання|падіння|зменшення|збільшення/i,
  /частка|відсоток|процент|частина/i,

  // English patterns - Analysis & Comparison
  /analy[sz]e|compar|trend|statistic|forecast|report/i,
  /where.*save|how much.*spend|most.*spending/i,
  /advice|recommend|budget|insight|planning/i,
  /how much.*left|balance|remaining/i,
  /average|total|sum|summary|overall/i,
  /increas|decreas|growth|decline|drop|rise/i,
  /share|percent|proportion|portion/i,

  // Pattern indicators - Time-based
  /last (month|week|year|quarter)|минулого (місяця|тижня|року|кварталу)/i,
  /this (month|week|year)|цього (місяця|тижня|року)/i,
  /previous|попередн|за період/i,
  /(january|february|march|april|may|june|july|august|september|october|november|december)/i,
  /(січня?|лютого?|березня?|квітня?|травня?|червня?|липня?|серпня?|вересня?|жовтня?|листопада?|грудня?)/i,

  // Category & Classification
  /category|categories|категор/i,
  /by type|за типом|по категор/i,
  /breakdown|розбивка|деталізац/i,

  // Questions requiring calculation/aggregation
  /how many|скільки разів/i,
  /what.*most|що найбільше|який найбільший/i,
  /show.*all|покажи всі|список/i,
  /top \d+|топ \d+|найбільш/i,

  // Financial metrics
  /expense|витрат|income|дохід|revenue|прибуток/i,
  /saving|заощадження|investment|інвестиц/i,
  /debt|борг|loan|кредит|позик|гроші|money/i,
  /cash flow|грошовий потік|liquidity|ліквідність/i,

  // Comparative language
  /more than|less than|більше ніж|менше ніж/i,
  /compare.*to|порівняти.*з|versus|проти/i,
  /difference|різниц|change|зміна/i,
  /better|worse|кращ|гірш/i,
];
