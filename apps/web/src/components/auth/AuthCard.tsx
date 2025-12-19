import Link from 'next/link';

type AuthCardProps = {
  title: string;
  description: string;
  footerText: string;
  footerLink: string;
  footerLinkText: string;
};

export default function AuthCard({
  title,
  description,
  children,
  footerText,
  footerLink,
  footerLinkText,
}: React.PropsWithChildren<AuthCardProps>) {
  return (
    <>
      <div className={'px-8 pt-8 pb-4 text-center'}>
        <div
          className={
            'w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto mb-4'
          }
        >
          <svg
            xmlns={'http://www.w3.org/2000/svg'}
            viewBox={'0 0 24 24'}
            fill={'none'}
            stroke={'currentColor'}
            strokeWidth={'2'}
            strokeLinecap={'round'}
            strokeLinejoin={'round'}
            className={'w-6 h-6'}
          >
            <path d={'M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.18 0 4.19.79 5.8 2.1'} />
          </svg>
        </div>

        <h1 className={'text-2xl font-semibold tracking-tight text-primary'}>{title}</h1>

        <p className={'text-sm text-muted-foreground mt-2'}>{description}</p>
      </div>

      <div className={'px-8 py-4'}>{children}</div>

      <div
        className={
          'px-8 py-6 bg-muted/30 text-center text-sm text-muted-foreground border-t border-border/40'
        }
      >
        {footerText}

        <Link
          href={footerLink}
          className={
            'font-medium text-primary hover:text-accent transition-colors underline underline-offset-4'
          }
        >
          {footerLinkText}
        </Link>
      </div>
    </>
  );
}
