'use client';

// FIXME: Whole file needs to be revised

import { usePathname, useRouter } from 'next/navigation';
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';

import { useGetCurrentUser, useLogout } from '#src/_generated/api/pfd-components';

type User = {
  id: string;
  email: string;
  name: string;
};

type UserContextType = {
  user: User | null;
  logout: () => void;
  isLoading: boolean;
};

const UserContext = createContext<UserContextType>({
  user: null,
  logout: () => {},
  isLoading: true,
});

export const useUser = () => useContext(UserContext).user;

export const useAuth = () => useContext(UserContext);

const isPublicPath = (path: string): boolean =>
  ['/login', '/register'].some(p => path.startsWith(p));

export function AuthGuard({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  const { data: user, isLoading, isError } = useGetCurrentUser({});
  const { mutate: logoutMutation } = useLogout();

  const logout = () => {
    logoutMutation(
      {},
      {
        onSettled: () => {
          router.push('/login');
        },
      },
    );
  };

  useEffect(() => {
    if (isLoading) return;

    const hasUser = !!user && !isError;

    // Redirect root
    if (pathname === '/') {
      router.replace(hasUser ? '/dashboard' : '/login');
      return;
    }

    // Authenticated user on public page -> redirect to dashboard
    if (hasUser && isPublicPath(pathname)) {
      router.replace('/dashboard');
      return;
    }

    // Unauthenticated user on protected page -> redirect to login
    if (!hasUser && !isPublicPath(pathname)) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
      return;
    }

    setIsChecking(false);
  }, [user, isLoading, isError, pathname, router]);

  // Show nothing while checking auth
  if (isChecking || isLoading) {
    return null; // Or a loading spinner
  }

  return (
    <UserContext.Provider value={{ user: user ?? null, logout, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}
