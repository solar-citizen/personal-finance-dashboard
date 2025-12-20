import { cn } from '../../lib/utils';
import InputWrapper, { Props as InputWrapperProps } from './InputWrapper';

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
  return (
    <InputWrapper label={label} error={error} className={className} tooltip={tooltip}>
      <input
        className={cn(
          'flex-1 text-left px-3 py-2 text-sm ring-offset-0 w-full focus-visible:ring-0 focus-visible:outline-none rounded-[9px]',
          disabled
            ? 'bg-[--color-input-disabled] border-border cursor-not-allowed opacity-60'
            : 'bg-input border-border',
        )}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
    </InputWrapper>
  );
}
