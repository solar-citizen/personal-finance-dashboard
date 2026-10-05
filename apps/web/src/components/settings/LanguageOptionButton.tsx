import { tv } from 'tailwind-variants';

const languageOption = tv({
  base: 'px-4 py-2 text-sm font-medium rounded-md border transition-colors cursor-pointer',
  variants: {
    selected: {
      true: 'bg-primary text-primary-foreground border-primary',
      false: 'bg-background text-foreground border-border hover:bg-muted',
    },
  },
  defaultVariants: {
    selected: false,
  },
});

type LanguageOptionButtonProps = React.ComponentProps<'button'> & {
  selected?: boolean;
};

export default function LanguageOptionButton({
  selected,
  className,
  children,
  ...props
}: LanguageOptionButtonProps) {
  return (
    <button type={'button'} className={languageOption({ selected, className })} {...props}>
      {children}
    </button>
  );
}
