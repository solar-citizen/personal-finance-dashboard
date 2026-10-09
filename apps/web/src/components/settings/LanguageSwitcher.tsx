'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { AppLanguage } from '#src/locales/types';

import LanguageOptionButton from './LanguageOptionButton';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const currentLanguage: AppLanguage =
    i18n.language === ('uk' as const) ? AppLanguage.UK : AppLanguage.EN;

  const handleLanguageChange = (lng: AppLanguage) => {
    void i18n.changeLanguage(lng);
    document.cookie = `NEXT_LOCALE=${lng}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  };

  return (
    <div className={'flex flex-col gap-2'}>
      <label className={'text-sm font-medium text-foreground'}>{t('settings.language')}</label>
      <p className={'text-xs text-muted-foreground'}>{t('settings.languageSelect')}</p>
      <div className={'flex gap-2 mt-1'}>
        <LanguageOptionButton
          selected={currentLanguage === AppLanguage.EN}
          onClick={() => handleLanguageChange(AppLanguage.EN)}
        >
          {t('settings.english')}
        </LanguageOptionButton>
        <LanguageOptionButton
          selected={currentLanguage === AppLanguage.UK}
          onClick={() => handleLanguageChange(AppLanguage.UK)}
        >
          {t('settings.ukrainian')}
        </LanguageOptionButton>
      </div>
    </div>
  );
}
