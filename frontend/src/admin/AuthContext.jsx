import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // Set when a stored session couldn't be checked because the server was unreachable.
  const [unreachable, setUnreachable] = useState(false)

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
      } catch (error) {
        // Only a rejected token ends the session. A dropped connection or a server
        // restart must not sign the admin out of a perfectly valid session.
        if (error.status === 401) api.logout()
        else if (!cancelled) setUnreachable(true)
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
    () => ({ user, loading, unreachable, signIn, signOut }),
    [user, loading, unreachable, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
