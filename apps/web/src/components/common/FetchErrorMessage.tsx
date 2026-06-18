import { cn } from '#src/lib/utils';

type FetchErrorMessageProps = {
  message?: string;
  className?: string;
};

export default function FetchErrorMessage({
  message = 'Failed to load data. Please try again.',
  className = '',
}: FetchErrorMessageProps) {
  return (
    <div className={cn('flex items-center justify-center h-auto text-red-400', className)}>
      {message}
    </div>
  );
}
