import { cn } from '#src/lib/utils';

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('bg-primary/10 animate-pulse rounded-md', className)}
      data-slot={'skeleton'}
      {...props}
    />
  );
}

type SkeletonListProps = {
  length: number;
  className: string;
};

export function SkeletonList({ length, className }: SkeletonListProps) {
  return (
    <>
      {Array.from({ length }).map((_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </>
  );
}
