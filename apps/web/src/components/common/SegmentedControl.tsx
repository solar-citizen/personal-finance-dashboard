import { tv } from 'tailwind-variants';

const segmentedControl = tv({
  slots: {
    root: 'flex gap-1 bg-secondary p-1 rounded-lg text-xs',
    button: 'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
  },
  variants: {
    active: {
      true: {
        button: 'bg-primary text-primary-foreground shadow-sm',
      },
      false: {
        button: 'text-muted-foreground hover:text-foreground',
      },
    },
  },
  defaultVariants: {
    active: false,
  },
});

type SegmentedControlProps = React.ComponentProps<'div'>;

export default function SegmentedControl({ className, children, ...props }: SegmentedControlProps) {
  const { root } = segmentedControl();

  return (
    <div className={root({ className })} {...props}>
      {children}
    </div>
  );
}

type SegmentedButtonProps = React.ComponentProps<'button'> & {
  active?: boolean;
};

export function SegmentedButton({ active, className, children, ...props }: SegmentedButtonProps) {
  const { button } = segmentedControl();

  return (
    <button type={'button'} className={button({ active, className })} {...props}>
      {children}
    </button>
  );
}
