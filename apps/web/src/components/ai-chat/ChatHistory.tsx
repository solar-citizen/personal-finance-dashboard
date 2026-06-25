import { useGetConversationsList } from '#src/_generated/api/pfd-components';

import QueryState from '../common/QueryState';

type ChatHistoryProps = {
  onSelectConversation: (id: string) => void;
};

export default function ChatHistory({ onSelectConversation }: ChatHistoryProps) {
  const { data, isLoading, error } = useGetConversationsList({});

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
            <button
              key={id}
              onClick={() => {
                onSelectConversation(id);
              }}
              className={
                'p-4 text-left border-b border-border hover:bg-secondary text-foreground cursor-pointer'
              }
            >
              {title}
            </button>
          ))
        }
      </QueryState>
    </div>
  );
}
