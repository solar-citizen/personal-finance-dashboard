import { skipToken, useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useGetConversationsList({});
  const { mutate: deleteConversation } = useDeleteConversation({
    onSuccess: async () => {
      // Safe invalidation of ALL conversation lists regardless of merged context variables
      await queryClient.invalidateQueries({
        queryKey: getConversationsListQuery(skipToken).queryKey,
      });
    },
  });

  return (
    <div className={'flex flex-col overflow-y-auto'}>
      <h3 className={'p-4 font-semibold text-foreground border-b border-border'}>
        {'Recent Conversations'}
      </h3>
      <QueryState
        isLoading={isLoading}
        error={error}
        data={data}
        errorMessage={'Failed to load conversations'}
        loadingFallback={<div className={'p-4 text-muted-foreground'}>{'Loading...'}</div>}
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
                title={'Delete conversation'}
                aria-label={'Delete conversation'}
              >
                {'Remove'}
              </button>
            </div>
          ))
        }
      </QueryState>
    </div>
  );
}
