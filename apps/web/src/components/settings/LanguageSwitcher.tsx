'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { cn } from '#src/lib/utils';
import { AppLanguage } from '#src/locales/types';

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
        <button
          type={'button'}
          onClick={() => handleLanguageChange(AppLanguage.EN)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md border transition-colors cursor-pointer',
            {
              'bg-primary text-primary-foreground border-primary':
                currentLanguage === AppLanguage.EN,
              'bg-background text-foreground border-border hover:bg-muted':
                currentLanguage !== AppLanguage.EN,
            },
          )}
        >
          {t('settings.english')}
        </button>
        <button
          type={'button'}
          onClick={() => handleLanguageChange(AppLanguage.UK)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md border transition-colors cursor-pointer',
            {
              'bg-primary text-primary-foreground border-primary':
                currentLanguage === AppLanguage.UK,
              'bg-background text-foreground border-border hover:bg-muted':
                currentLanguage !== AppLanguage.UK,
            },
          )}
        >
          {t('settings.ukrainian')}
        </button>
      </div>
    </div>
  );
}
