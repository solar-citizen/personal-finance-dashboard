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

export const messageRoles = ['system', 'user', 'assistant'] as const;
export type MessageRole = (typeof messageRoles)[number];

export type StreamResponse =
  | { type: 'start'; conversationId: string; modelUsed: string }
  | { type: 'chunk'; content: string }
  | { type: 'end'; responseTimeMs: number; modelUsed: string };
