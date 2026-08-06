'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { useLogout } from '#src/_generated/api/pfd-components';

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

  return (
    <nav
      className={
        'h-14 bg-background fixed top-0 right-0 left-0 z-10 flex w-full items-center gap-4 px-5 py-2.5 shadow-md'
      }
    >
      {links.map(({ name, href }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={
              isActive
                ? 'text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }
          >
            {name}
          </Link>
        );
      })}

      {/* FIXME: Temporary unstyled button */}
      <button onClick={handleLogout}>{'Logout'}</button>
    </nav>
  );
}
