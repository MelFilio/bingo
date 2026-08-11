import { createContext } from 'react'
import type { User } from 'firebase/auth'

export interface UserProfile {
  displayName: string
  email: string | null
  username?: string
  usernameLower?: string
}

export interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  saveUsername: (username: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
