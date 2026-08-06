'use client';

import { useTranslation } from 'react-i18next';

import LanguageSwitcher from '#src/components/settings/LanguageSwitcher';

export default function Settings() {
  const { t } = useTranslation();

  return (
    <div className={'space-y-6'}>
      <div>
        <h1 className={'text-2xl font-bold tracking-tight text-foreground'}>
          {t('settings.title')}
        </h1>
      </div>
      <div className={'p-6 bg-card border border-border rounded-lg shadow-sm'}>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
