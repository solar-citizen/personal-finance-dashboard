'use client';

import { useTranslation } from 'react-i18next';

import Button from '../common/Button';

type ChatBubbleProps = {
  onShow: () => void;
};

export default function ChatBubble({ onShow }: ChatBubbleProps) {
  const { t } = useTranslation();

  return (
    <Button
      onClick={onShow}
      variant={'primary'}
      className={'fixed bottom-6 right-6 z-50 rounded-full p-4 shadow-lg hover:scale-105'}
    >
      {t('aiChat.askAi')}
    </Button>
  );
}
