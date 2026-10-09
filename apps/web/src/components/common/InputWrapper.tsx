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
    <div className={cn('flex flex-col gap-1.5 w-full', className)} {...props}>
      {label && (
        <label className={'text-sm font-medium leading-none text-foreground'}>
          {label}
          {tooltip && (
            <span className={'text-xs text-muted-foreground ml-1'}>{`(${tooltip})`}</span>
          )}
        </label>
      )}

      {children}

      {error && <p className={'text-xs text-destructive font-medium leading-tight'}>{error}</p>}
    </div>
  );
}
