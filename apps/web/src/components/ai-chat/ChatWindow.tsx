import type { MessageRole, StreamResponse } from '@pfd/shared';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

import { useGetConversation } from '#src/_generated/api/pfd-components';
import QueryState from '#src/components/common/QueryState';
import { cn } from '#src/lib/utils';

import ChatHistory from './ChatHistory';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStreamResponse(obj: Record<string, unknown>): obj is StreamResponse {
  switch (obj.type) {
    case 'start':
      return typeof obj.conversationId === 'string' && typeof obj.modelUsed === 'string';
    case 'chunk':
      return typeof obj.content === 'string';
    case 'end':
      return typeof obj.responseTimeMs === 'number' && typeof obj.modelUsed === 'string';
    default:
      return false;
  }
}

function isDisplayableMessage<T extends { role: string }>(
  m: T,
): m is T & { role: 'user' | 'assistant' } {
  return m.role === 'user' || m.role === 'assistant';
}

type FetchedMessage = {
  id: string;
  role: MessageRole;
  content: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type MessageListProps = {
  messages: FetchedMessage[];
};

function MessageList({ messages }: MessageListProps) {
  return (
    <>
      {messages.filter(isDisplayableMessage).map(({ id, role, content }) => (
        <MessageBubble key={id} role={role} content={content} />
      ))}
    </>
  );
}

type MessageBubbleProps = Pick<Message, 'role' | 'content'>;

function MessageBubble({ role, content }: MessageBubbleProps) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg p-3 ${
          role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground prose prose-sm dark:prose-invert'
        }`}
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

type ChatWindowProps = {
  isOpen: boolean;
  onHide: () => void;
};

export default function ChatWindow({ isOpen, onHide }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingConversationId, setPendingConversationId] = useState<string | undefined>(undefined);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const {
    data: selectedConversation,
    isLoading: isConversationLoading,
    error: conversationError,
  } = useGetConversation(
    {
      pathParams: {
        id: pendingConversationId ?? '',
      },
    },
    {
      enabled: !!pendingConversationId,
      staleTime: Infinity,
    },
  );

  useEffect(() => {
    if (!selectedConversation || !pendingConversationId) {
      return;
    }

    setConversationId(pendingConversationId);
    setMessages(
      selectedConversation.messages
        .filter(isDisplayableMessage)
        .map(({ role, content }) => ({ id: crypto.randomUUID(), role, content })),
    );
    setPendingConversationId(undefined);
  }, [selectedConversation, pendingConversationId]);

  const onSelectConversation = (id: string) => {
    setPendingConversationId(id);
    setShowHistory(false);
  };

  const onNewConversation = () => {
    setMessages([]);
    setConversationId(undefined);
    setPendingConversationId(undefined);
    setInput('');
    setShowHistory(false);
  };

  async function sendMessage() {
    if (!input.trim() || isStreaming) {
      return;
    }

    const userMessage = input;
    setInput('');
    setIsStreaming(true);

    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: userMessage },
      { id: crypto.randomUUID(), role: 'assistant', content: '' },
    ]);

    try {
      const response = await window.fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/chat/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage, conversationId }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream failed: ${response.status}`);
      }

      let buffer = '';
      const decoder = new TextDecoder();

      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, {
          stream: true,
        });

        const lines = buffer.split('\n');

        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed.startsWith('data:')) {
            continue;
          }

          const jsonStr = trimmed.slice(5).trim();

          if (!jsonStr) {
            continue;
          }

          try {
            const parsed: unknown = JSON.parse(jsonStr);

            if (isRecord(parsed) && isStreamResponse(parsed)) {
              if (parsed.type === 'start' && parsed.conversationId) {
                setConversationId(parsed.conversationId);
              } else if (parsed.type === 'chunk' && parsed.content) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastIndex = newMessages.length - 1;
                  newMessages[lastIndex] = {
                    ...newMessages[lastIndex],
                    content: newMessages[lastIndex].content + parsed.content,
                  };
                  return newMessages;
                });
              }
            }
          } catch (err: unknown) {
            console.error('Failed to parse stream chunk', err);
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { id: crypto.randomUUID(), role: 'assistant', content: 'Sorry, I encountered an error.' },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex h-[500px] w-[400px] flex-col',
        'rounded-lg border border-border bg-card shadow-xl',
        'origin-bottom-right transition-[opacity,transform] duration-300 ease-out',
        isOpen
          ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
          : 'pointer-events-none translate-y-3 scale-95 opacity-0',
      )}
    >
      <div className={'relative flex items-center justify-between border-b border-border p-4'}>
        <div className={'flex items-center gap-2'}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={'text-muted-foreground hover:text-foreground cursor-pointer'}
          >
            {showHistory ? 'Back' : 'History'}
          </button>

          <button
            onClick={onNewConversation}
            disabled={isStreaming}
            className={
              'text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer'
            }
          >
            {'New'}
          </button>
        </div>

        <h2 className={'absolute left-1/2 -translate-x-1/2 font-semibold text-foreground'}>
          {'AI Assistant'}
        </h2>

        <button
          onClick={onHide}
          className={'text-muted-foreground hover:text-foreground cursor-pointer'}
        >
          {'✕'}
        </button>
      </div>

      {showHistory ? (
        <ChatHistory onSelectConversation={onSelectConversation} />
      ) : (
        <>
          <div className={'flex-1 overflow-y-auto p-4 space-y-4'}>
            {pendingConversationId ? (
              <QueryState
                isLoading={isConversationLoading}
                error={conversationError}
                data={selectedConversation}
                errorMessage={'Failed to load conversation'}
                loadingFallback={
                  <div className={'p-4 text-center text-muted-foreground'}>
                    {'Loading conversation...'}
                  </div>
                }
              >
                {({ messages }) => <MessageList messages={messages} />}
              </QueryState>
            ) : (
              <>
                <MessageList messages={messages} />
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          <div className={'flex items-center gap-2 border-t border-border p-4'}>
            <input
              value={input}
              onChange={({ target }) => {
                setInput(target.value);
              }}
              onKeyDown={({ key }) => {
                if (key === 'Enter') {
                  void sendMessage();
                }
              }}
              placeholder={'Ask me anything...'}
              className={'flex-1 rounded-md border border-input p-2 text-foreground'}
              disabled={isStreaming}
            />
            <button
              onClick={() => {
                void sendMessage();
              }}
              disabled={isStreaming || !input.trim()}
              className={
                'rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer'
              }
            >
              {'Send'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
