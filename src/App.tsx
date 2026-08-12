import { useState } from 'react'
import { useAuth } from './auth/useAuth'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { UsernamePage } from './pages/UsernamePage'
import { Logo } from './components/Logo'
import { Spinner } from './components/Spinner'
import { RoomPage } from './pages/RoomPage'

export function App() {
  const { user, profile, loading } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [roomCode, setRoomCode] = useState(() =>
    new URLSearchParams(window.location.search).get('room'),
  )

  function openRoom(code: string) {
    window.history.pushState({}, '', `?room=${code}`)
    setRoomCode(code)
  }

  function closeRoom() {
    window.history.pushState({}, '', window.location.pathname)
    setRoomCode(null)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-[22px] text-primary">
        <Logo />
        <Spinner label="Restoring your session" />
      </main>
    )
  }

  if (!user) {
    return <AuthPage mode={mode} onModeChange={setMode} />
  }

  if (!profile?.username) {
    return <UsernamePage />
  }

  if (roomCode) {
    return <RoomPage code={roomCode} onLeave={closeRoom} />
  }

  return <DashboardPage onOpenRoom={openRoom} />
}
