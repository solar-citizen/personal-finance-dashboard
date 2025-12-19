import { cn } from '../../lib/utils';

export type Props = React.PropsWithChildren<
  React.HTMLAttributes<HTMLDivElement> & {
    label?: string;
    className?: string;
    error?: string;
    tooltip?: string;
  }
>;

export default function InputWrapper({
  label,
  children,
  error,
  className,
  tooltip,
  ...props
}: Props) {
  return (
    <div className={cn('block relative w-full', className)} {...props}>
      {label && (
        <label className={'text-sm font-medium leading-none text-foreground mb-2 block'}>
          {label}
          {tooltip && (
            <span className={'text-xs text-muted-foreground ml-1'}>{`(${tooltip})`}</span>
          )}
        </label>
      )}

      {children}

      {error && <p className={'absolute text-sm text-destructive mt-1 left-0'}>{error}</p>}
    </div>
  );
}
