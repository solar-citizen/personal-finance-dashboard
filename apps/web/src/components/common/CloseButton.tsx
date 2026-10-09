import { tv } from 'tailwind-variants';

const closeButton = tv({
  base: 'text-muted-foreground hover:text-destructive transition-colors cursor-pointer',
});

type CloseButtonProps = React.ComponentProps<'button'>;

export default function CloseButton({ className, ...props }: CloseButtonProps) {
  return (
    <button type={'button'} className={closeButton({ className })} {...props}>
      {'✕'}
    </button>
  );
}
