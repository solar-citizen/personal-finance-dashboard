import { tv } from 'tailwind-variants';

import InputWrapper, { Props as InputWrapperProps } from './InputWrapper';

const input = tv({
  slots: {
    root: 'flex-1 text-left px-3 py-2 text-sm ring-offset-0 w-full focus-visible:ring-0 focus-visible:outline-none rounded-[9px] border transition-colors',
  },
  variants: {
    error: {
      true: { root: 'border-destructive' },
      false: { root: 'border-border' },
    },
    disabled: {
      true: { root: 'bg-[--color-input-disabled] border-border cursor-not-allowed opacity-60' },
      false: { root: 'bg-input' },
    },
  },
  defaultVariants: {
    error: false,
    disabled: false,
  },
});

export type Props = React.ComponentProps<'input'> & InputWrapperProps;

export default function Input({
  className,
  label,
  error,
  onChange,
  disabled,
  tooltip,
  ...props
}: Props) {
  const { root } = input({ error: !!error, disabled: !!disabled });

  return (
    <InputWrapper label={label} error={error} className={className} tooltip={tooltip}>
      <input
        className={root()}
        onChange={onChange}
        disabled={disabled}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
    </InputWrapper>
  );
}
