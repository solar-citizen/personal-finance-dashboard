type FetchErrorMessageProps = {
  message?: string;
};

export default function FetchErrorMessage({
  message = 'Failed to load data. Please try again.',
}: FetchErrorMessageProps) {
  return <div className={'flex items-center justify-center h-auto text-red-400'}>{message}</div>;
}
