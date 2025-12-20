'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';

import { useGetCurrentUser, useLogout } from '#src/_generated/api/pfd-components';
import { UserDto } from '#src/_generated/api/pfd-types';

type UserContextType = {
  user: UserDto | null;
  logout: () => void;
  isLoading: boolean;
};

const UserContext = createContext<UserContextType>({
  user: null,
  logout: () => {
    console.warn('logout called outside of AuthGuard provider');
  },
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
    if (isLoading) {
      return;
    }

    const hasUser = !!user && !isError;

    if (pathname === '/') {
      router.replace(hasUser ? '/dashboard' : '/login');
      return;
    }

    if (hasUser && isPublicPath(pathname)) {
      router.replace('/dashboard');
      return;
    }

    if (!hasUser && !isPublicPath(pathname)) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
      return;
    }

    setIsChecking(false);
  }, [user, isLoading, isError, pathname, router]);

  if (isChecking || isLoading) {
    return null;
  }

  return (
    <UserContext.Provider value={{ user: user ?? null, logout, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}
