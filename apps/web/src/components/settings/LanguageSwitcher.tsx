'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { AppLanguage } from '#src/locales/types';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const currentLanguage: AppLanguage =
    i18n.language === ('uk' as const) ? AppLanguage.UK : AppLanguage.EN;

  const handleLanguageChange = (lng: AppLanguage) => {
    void i18n.changeLanguage(lng);
    document.cookie = `NEXT_LOCALE=${lng}; path=/; max-age=31536000; SameSite=Lax`;
    localStorage.setItem('i18nextLng', lng);
    router.refresh();
  };

  return (
    <div className={'flex flex-col gap-2'}>
      <label className={'text-sm font-medium text-foreground'}>{t('settings.language')}</label>
      <p className={'text-xs text-muted-foreground'}>{t('settings.languageSelect')}</p>
      <div className={'flex gap-2 mt-1'}>
        <button
          type={'button'}
          onClick={() => handleLanguageChange(AppLanguage.EN)}
          className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
            currentLanguage === AppLanguage.EN
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:bg-muted'
          }`}
        >
          {t('settings.english')}
        </button>
        <button
          type={'button'}
          onClick={() => handleLanguageChange(AppLanguage.UK)}
          className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
            currentLanguage === AppLanguage.UK
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:bg-muted'
          }`}
        >
          {t('settings.ukrainian')}
        </button>
      </div>
    </div>
  );
}
