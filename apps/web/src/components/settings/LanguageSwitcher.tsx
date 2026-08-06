'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const currentLanguage = i18n.language || 'en';

  const handleLanguageChange = (lng: string) => {
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
          onClick={() => handleLanguageChange('en')}
          className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
            currentLanguage === 'en'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:bg-muted'
          }`}
        >
          {t('settings.english')}
        </button>
        <button
          type={'button'}
          onClick={() => handleLanguageChange('uk')}
          className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
            currentLanguage === 'uk'
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
