'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { LogIn, LogOut } from 'lucide-react';
import Button from './ui/Button';
import Skeleton from './ui/Skeleton';

export default function LoginButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <Skeleton variant="rounded" width="120px" height="44px" />;
  }

  if (session) {
    return (
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-sm font-medium text-gray-700 max-w-[150px] truncate">
          {session.user?.name || session.user?.email}
        </span>
        <Button
          variant="outline"
          colorScheme="error"
          size="md"
          leftIcon={<LogOut size={16} />}
          onClick={() => signOut()}
        >
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="solid"
      colorScheme="info"
      size="md"
      leftIcon={<LogIn size={16} />}
      onClick={() => signIn('google')}
    >
      Sign In
    </Button>
  );
}
