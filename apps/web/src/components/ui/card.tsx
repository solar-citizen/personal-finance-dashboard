import { tv } from 'tailwind-variants';

const card = tv({
  slots: {
    root: 'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
    header: 'flex flex-col gap-1.5 px-6',
    title: 'text-lg font-semibold leading-none tracking-tight',
    description: 'text-muted-foreground text-sm',
    content: 'px-6',
    footer: 'flex items-center px-6',
  },
});

const slots = card();

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot={'card'} className={slots.root({ className })} {...props} />;
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot={'card-header'} className={slots.header({ className })} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot={'card-title'} className={slots.title({ className })} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot={'card-description'} className={slots.description({ className })} {...props} />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot={'card-content'} className={slots.content({ className })} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot={'card-footer'} className={slots.footer({ className })} {...props} />;
}
