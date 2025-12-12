import type { PropsWithChildren } from 'react';

import MainNav from '#src/components/MainNav';

export default function MainLayout({ children }: PropsWithChildren) {
  return (
    <>
      <MainNav />
      <main className={'p-5 mt-9'}>{children}</main>
    </>
  );
}
