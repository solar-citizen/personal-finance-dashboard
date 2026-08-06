'use client';

import { useTranslation } from 'react-i18next';

type ChatBubbleProps = {
  onShow: () => void;
};

export default function ChatBubble({ onShow }: ChatBubbleProps) {
  const { t } = useTranslation();

  return (
    <button
      onClick={onShow}
      className={
        'fixed bottom-6 right-6 z-50 rounded-full bg-primary p-4 text-primary-foreground shadow-lg transition-transform hover:scale-105 cursor-pointer'
      }
    >
      {t('aiChat.askAi')}
    </button>
  );
}
