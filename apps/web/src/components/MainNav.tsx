'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { tv } from 'tailwind-variants';

import { useLogout } from '#src/_generated/api/pfd-components';

const mainNav = tv({
  slots: {
    root: 'h-14 bg-background fixed top-0 right-0 left-0 z-10 flex w-full items-center justify-between px-5 py-2.5 shadow-md',
    link: 'transition-colors',
    logoutButton:
      'text-sm font-medium text-muted-foreground hover:text-destructive transition-colors cursor-pointer',
  },
  variants: {
    active: {
      true: {
        link: 'text-foreground font-semibold',
      },
      false: {
        link: 'text-muted-foreground hover:text-foreground',
      },
    },
  },
  defaultVariants: {
    active: false,
  },
});

export default function MainNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  const { mutate } = useLogout();

  const handleLogout = () => {
    mutate({});
    router.replace('/login');
  };

  const links = [
    { name: t('nav.dashboard'), href: '/dashboard' },
    { name: t('nav.transactions'), href: '/transactions' },
    { name: t('nav.settings'), href: '/settings' },
  ];

  const { root, link, logoutButton } = mainNav();

  return (
    <nav className={root()}>
      <div className={'flex items-center gap-4'}>
        {links.map(({ name, href }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href} className={link({ active: isActive })}>
              {name}
            </Link>
          );
        })}
      </div>

      <button onClick={handleLogout} className={logoutButton()}>
        {t('common.logout')}
      </button>
    </nav>
  );
}
