import ChatContainer from '#src/components/ai-chat/ChatContainer';
import MainNav from '#src/components/MainNav';

import { AuthGuard } from '../AuthGuard';

export default function MainLayout({ children }: React.PropsWithChildren) {
  return (
    <>
      <MainNav />
      <main className={'p-5 mt-9'}>
        <AuthGuard>{children}</AuthGuard>
      </main>
      <ChatContainer />
    </>
  );
}
