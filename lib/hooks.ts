import { useState, useEffect } from 'react';
import { type User } from 'firebase/auth';
import { watchAuth } from './auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = watchAuth(setUser);
    return () => unsubscribe();
  }, []);

  return user;
}
