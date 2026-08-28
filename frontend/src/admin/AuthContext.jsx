import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // A stored token may be expired or revoked, so verify it against the API
  // rather than trusting its presence.
  useEffect(() => {
    let cancelled = false

    async function restore() {
      if (!api.getToken()) {
        setLoading(false)
        return
      }
      try {
        const me = await api.getMe()
        if (!cancelled) setUser(me)
      } catch {
        api.logout()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    restore()
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    await api.login(email, password)
    const me = await api.getMe()
    setUser(me)
    return me
  }, [])

  const signOut = useCallback(() => {
    api.logout()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, isAdmin: user?.role === 'admin' }),
    [user, loading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
