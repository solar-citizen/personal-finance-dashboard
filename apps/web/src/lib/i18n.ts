import i18n, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '#src/locales/en.json';
import { AppLanguage, defaultLanguage } from '#src/locales/types';
import uk from '#src/locales/uk.json';

const resources = {
  [AppLanguage.EN]: { translation: en },
  [AppLanguage.UK]: { translation: uk },
};

const commonConfig = {
  resources,
  fallbackLng: defaultLanguage,
  interpolation: {
    escapeValue: false,
  },
} as const;

/**
 * Creates a fresh i18n instance bound to the given locale.
 * Each call returns an isolated instance — safe for concurrent SSR
 * requests that may resolve different locales simultaneously, and
 * safe under React Strict Mode's double-invoked lazy useState initializer
 * (the discarded instance is just garbage collected).
 */
export function createI18nInstance(lng: string = defaultLanguage): I18nInstance {
  const instance = i18n.createInstance();

  void instance.use(initReactI18next).init({
    ...commonConfig,
    lng,
  });

  return instance;
}
