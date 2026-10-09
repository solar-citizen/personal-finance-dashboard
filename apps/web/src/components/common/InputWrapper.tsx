import { tv } from 'tailwind-variants';

const inputWrapper = tv({
  slots: {
    root: 'flex flex-col gap-1.5 w-full',
    label: 'text-sm font-medium leading-none text-foreground',
    tooltip: 'text-xs text-muted-foreground ml-1',
    error: 'text-xs text-destructive font-medium leading-tight',
  },
});

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
  const slots = inputWrapper();

  return (
    <div className={slots.root({ className })} {...props}>
      {label && (
        <label className={slots.label()}>
          {label}
          {tooltip && <span className={slots.tooltip()}>{`(${tooltip})`}</span>}
        </label>
      )}

      {children}

      {error && <p className={slots.error()}>{error}</p>}
    </div>
  );
}
