import { auth } from './firebase'
import { onAuthStateChanged, type User } from 'firebase/auth'

export function watchAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb)
}

// Minimal helpers so pages can compile even if you later replace logic.
export async function getCurrentUser(): Promise<User | null> {
  return auth.currentUser ?? null
}
