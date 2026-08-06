import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '#src/locales/en.json';
import { AppLanguage, defaultLanguage } from '#src/locales/types';
import uk from '#src/locales/uk.json';

const resources = {
  [AppLanguage.EN]: { translation: en },
  [AppLanguage.UK]: { translation: uk },
};

export function initI18n(lng: string = defaultLanguage) {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: defaultLanguage,
      interpolation: {
        escapeValue: false,
      },
    });
  } else if (i18n.language !== lng) {
    void i18n.changeLanguage(lng);
  }

  return i18n;
}
