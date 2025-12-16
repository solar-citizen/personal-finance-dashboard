'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useLogout } from '#src/_generated/api/pfd-components';

type NavLink = {
  name: `${Uppercase<string>}${string}`;
  href: `/${string}`;
};

const links: NavLink[] = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Transactions', href: '/transactions' },
  { name: 'Settings', href: '/settings' },
];

export default function MainNav() {
  const router = useRouter();

  const { mutate } = useLogout();

  const handleLogout = () => {
    mutate({});
    router.replace('/login');
  };

  return (
    <nav
      className={
        'h-14 bg-background fixed top-0 right-0 left-0 z-10 flex w-full items-center gap-4 px-5 py-2.5 shadow-md'
      }
    >
      {links.map(({ name, href }) => (
        <Link key={name} href={href}>
          {name}
        </Link>
      ))}

      <button onClick={handleLogout}>{'Logout'}</button>
    </nav>
  );
}
