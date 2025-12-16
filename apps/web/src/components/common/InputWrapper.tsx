import { cn } from '../../lib/utils';

export type Props = React.PropsWithChildren<
  React.HTMLAttributes<HTMLDivElement> & {
    label?: string;
    className?: string;
    error?: string;
    disabled?: boolean; // FIXME: Add usage or remove
    isEmpty?: boolean; // FIXME: Add usage or remove
    tooltip?: string;
  }
>;

export default function InputWrapper({
  label,
  children,
  error,
  className,
  disabled,
  isEmpty,
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

      <div
        className={cn(!isEmpty && 'border border-input', 'flex gap-2 items-center rounded-md', {
          'border-destructive': error,
          'opacity-50 cursor-not-allowed': disabled,
        })}
      >
        {children}
      </div>

      {error && <p className={'absolute text-sm text-destructive mt-1 left-0'}>{error}</p>}
    </div>
  );
}
