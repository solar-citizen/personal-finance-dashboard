export const accountTypeNames: Record<string, string> = {
  black: 'Чорна',
  white: 'Біла',
  platinum: 'Платинова',
  iron: 'Залізна',
  fop: 'ФОП',
  yellow: 'Жовта',
  eAid: 'єПідтримка',
  madeInUkraine: 'Національний Кешбек',
};

export const periods = ['day', 'week', 'month', 'year'] as const;
export type Period = (typeof periods)[number];
