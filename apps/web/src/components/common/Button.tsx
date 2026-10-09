import { tv } from 'tailwind-variants';

const button = tv({
  slots: {
    root: 'cursor-pointer inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  },
  variants: {
    variant: {
      primary: {
        root: 'bg-primary text-primary-foreground hover:bg-primary/90 rounded-md',
      },
      ghost: {
        root: 'text-muted-foreground hover:text-destructive',
      },
      outline: {
        root: 'border border-input bg-background text-foreground hover:bg-muted rounded-md',
      },
    },
    size: {
      sm: {
        root: 'text-xs px-2.5 py-1',
      },
      md: {
        root: 'text-sm h-10 px-4 py-2',
      },
      lg: {
        root: 'text-base h-12 px-6 py-3',
      },
    },
    fullWidth: {
      true: {
        root: 'w-full',
      },
      false: {
        root: '',
      },
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
    fullWidth: false,
  },
});

type ButtonProps = React.ComponentProps<'button'> & {
  variant?: 'primary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
};

export default function Button({
  className,
  variant,
  size,
  fullWidth,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const { root } = button({ variant, size, fullWidth });

  return (
    <button className={root({ className })} type={type} {...props}>
      {children}
    </button>
  );
}
