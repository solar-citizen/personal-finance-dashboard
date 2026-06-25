type ChatBubbleProps = {
  onClick: () => void;
};

export default function ChatBubble({ onClick }: ChatBubbleProps) {
  return (
    <button
      onClick={onClick}
      className={
        'fixed bottom-6 right-6 z-50 rounded-full bg-primary p-4 text-primary-foreground shadow-lg transition-transform hover:scale-105 cursor-pointer'
      }
    >
      {'Ask AI'}
    </button>
  );
}
