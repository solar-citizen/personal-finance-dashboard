import FetchErrorMessage from '#src/components/common/FetchErrorMessage';

type QueryStateProps<T> = {
  isLoading: boolean;
  error: unknown;
  data: T | undefined;
  errorMessage: string;
  loadingFallback: React.ReactNode;
  children: (data: T) => React.ReactNode;
};

export default function QueryState<T>({
  isLoading,
  error,
  data,
  loadingFallback,
  errorMessage,
  children,
}: QueryStateProps<T>) {
  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  if (error) {
    return <FetchErrorMessage message={errorMessage} />;
  }

  if (!data) {
    return null;
  }

  return <>{children(data)}</>;
}
