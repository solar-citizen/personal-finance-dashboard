'use client';

import { skipToken, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
  getConversationsListQuery,
  useDeleteConversation,
  useGetConversationsList,
} from '#src/_generated/api/pfd-components';

import QueryState from '../common/QueryState';

type ChatHistoryProps = {
  onSelectConversation: (id: string) => void;
};

export default function ChatHistory({ onSelectConversation }: ChatHistoryProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useGetConversationsList({});
  const { mutate: deleteConversation } = useDeleteConversation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getConversationsListQuery(skipToken).queryKey,
      });
    },
  });

  return (
    <div className={'flex flex-col overflow-y-auto'}>
      <h3 className={'p-4 font-semibold text-foreground border-b border-border'}>
        {t('aiChat.recentConversations')}
      </h3>
      <QueryState
        isLoading={isLoading}
        error={error}
        data={data}
        errorMessage={t('aiChat.failedConversations')}
        loadingFallback={<div className={'p-4 text-muted-foreground'}>{t('common.loading')}</div>}
      >
        {conversations =>
          conversations.map(({ id, title }) => (
            <div
              key={id}
              className={
                'flex items-center justify-between border-b border-border hover:bg-secondary text-foreground'
              }
            >
              <button
                onClick={() => {
                  onSelectConversation(id);
                }}
                className={'grow p-4 text-left cursor-pointer'}
              >
                {title}
              </button>
              <button
                onClick={() => {
                  deleteConversation({ pathParams: { id } });
                }}
                className={'p-4 text-muted-foreground hover:text-destructive'}
                title={t('aiChat.deleteConversation')}
                aria-label={t('aiChat.deleteConversation')}
              >
                {t('common.remove')}
              </button>
            </div>
          ))
        }
      </QueryState>
    </div>
  );
}
