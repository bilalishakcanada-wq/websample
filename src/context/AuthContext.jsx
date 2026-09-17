import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { authService } from '../services/authService'
import { trustService } from '../services/trustService'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [staffRole, setStaffRole] = useState(null) // 'admin' | 'moderator' | null
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshAdminStatus = async (currentUser) => {
    if (!currentUser) {
      setStaffRole(null)
      return
    }
    const { data, error: rpcError } = await supabase.rpc('staff_role')
    setStaffRole(!rpcError && (data === 'admin' || data === 'moderator') ? data : null)
    trustService.touchLastSeen()
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return undefined
    }

    const initSession = async () => {
      try {
        const data = await authService.getSession()
        const sessionUser = data?.session?.user || null
        setUser(sessionUser)
        await refreshAdminStatus(sessionUser)
      } catch (sessionError) {
        setError(sessionError.message)
      } finally {
        setLoading(false)
      }
    }

    initSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user || null
      setUser(sessionUser)
      // resolve the admin role before letting guarded routes decide
      refreshAdminStatus(sessionUser).finally(() => setLoading(false))
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const login = async (payload) => {
    setError('')
    const result = await authService.signIn(payload)
    setUser(result.user)
    return result
  }

  const register = async (payload) => {
    setError('')
    const result = await authService.signUp(payload)
    setUser(result.session ? result.user : null)
    return result
  }

  const loginWithProvider = async (provider) => {
    setError('')
    return authService.signInWithProvider(provider)
  }

  const logout = async () => {
    setError('')
    await authService.signOut()
    setUser(null)
  }

  const refreshSession = async () => {
    const result = await authService.refreshSession()
    setUser(result.user)
    return result
  }

  const updateProfile = (changes) => {
    setUser((current) => ({ ...current, ...changes }))
  }

  const deleteAccount = async () => {
    await authService.deleteAccount()
    setUser(null)
  }

  const isAdmin = staffRole === 'admin'
  const isModerator = staffRole === 'moderator'
  const value = useMemo(
    () => ({ user, isAdmin, isModerator, isStaff: isAdmin || isModerator, staffRole, loading, error, login, loginWithProvider, register, logout, refreshSession, updateProfile, deleteAccount }),
    [user, isAdmin, isModerator, staffRole, loading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
