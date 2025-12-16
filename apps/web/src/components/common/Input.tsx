import { cn } from '../../lib/utils';
import InputWrapper, { Props as InputWrapperProps } from './InputWrapper';

export type Props = React.ComponentProps<'input'> & InputWrapperProps;

export default function Input({
  className,
  label,
  error,
  onChange,
  disabled, // FIXME: Add usage or remove
  tooltip,
  ...props
}: Props) {
  return (
    <InputWrapper
      label={label}
      error={error}
      className={className}
      disabled={disabled}
      tooltip={tooltip}
    >
      {/* FIXME: Add bg-(--color-input-disabled) to globals.css */}
      <input
        className={cn(
          'flex-1 text-left px-3 py-2 text-sm ring-offset-0 w-full focus-visible:ring-0 focus-visible:outline-none rounded-[9px]',
          { 'bg-(--color-input-disabled) border-zinc-200': !disabled },
        )}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
    </InputWrapper>
  );
}
