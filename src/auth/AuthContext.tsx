import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { auth, db } from '../lib/firebase'
import {
  AuthContext,
  type AuthContextValue,
  type UserProfile,
} from './auth-context'
import type { User } from 'firebase/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined

    const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
      unsubscribeProfile?.()
      setUser(nextUser)
      setProfile(null)

      if (!nextUser) {
        setLoading(false)
        return
      }

      unsubscribeProfile = onSnapshot(
        doc(db, 'users', nextUser.uid),
        (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile)
            setLoading(false)
            return
          }

          void setDoc(doc(db, 'users', nextUser.uid), {
            displayName: nextUser.displayName ?? 'Bingo member',
            email: nextUser.email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch(() => {
            setProfile(null)
            setLoading(false)
          })
        },
        () => {
          setProfile(null)
          setLoading(false)
        },
      )
    })

    return () => {
      unsubscribeAuth()
      unsubscribeProfile?.()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email, password)
      },
      async signUp(name, email, password) {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        )

        await updateProfile(credential.user, { displayName: name })
        await setDoc(doc(db, 'users', credential.user.uid), {
          displayName: name,
          email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      },
      async signInWithGoogle() {
        const provider = new GoogleAuthProvider()
        provider.setCustomParameters({ prompt: 'select_account' })
        const credential = await signInWithPopup(auth, provider)
        const profileRef = doc(db, 'users', credential.user.uid)
        const profile = await getDoc(profileRef)

        if (profile.exists()) {
          await updateDoc(profileRef, {
            displayName: credential.user.displayName ?? 'Bingo member',
            email: credential.user.email,
            updatedAt: serverTimestamp(),
          })
        } else {
          await setDoc(profileRef, {
            displayName: credential.user.displayName ?? 'Bingo member',
            email: credential.user.email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        }
      },
      async saveUsername(username) {
        if (!user) {
          throw new Error('You must be signed in to create a username.')
        }

        const normalizedUsername = username.trim().toLowerCase()
        const usernameRef = doc(db, 'usernames', normalizedUsername)
        const profileRef = doc(db, 'users', user.uid)
        const previousUsername = profile?.usernameLower

        if (normalizedUsername === previousUsername) {
          return
        }

        await runTransaction(db, async (transaction) => {
          const usernameSnapshot = await transaction.get(usernameRef)

          if (usernameSnapshot.exists()) {
            throw new Error('USERNAME_TAKEN')
          }

          transaction.set(usernameRef, {
            uid: user.uid,
            username: username.trim(),
            createdAt: serverTimestamp(),
          })
          transaction.update(profileRef, {
            username: username.trim(),
            usernameLower: normalizedUsername,
            updatedAt: serverTimestamp(),
          })

          if (previousUsername) {
            transaction.delete(doc(db, 'usernames', previousUsername))
          }
        })
      },
      async signOut() {
        await firebaseSignOut(auth)
      },
    }),
    [loading, profile, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
