import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '#src/locales/en.json';
import uk from '#src/locales/uk.json';

const resources = {
  en: { translation: en },
  uk: { translation: uk },
};

export function initI18n(lng = 'en') {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
    });
  } else if (i18n.language !== lng) {
    i18n.changeLanguage(lng);
  }

  return i18n;
}
