import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { authService } from '../services/authService'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshAdminStatus = async (currentUser) => {
    if (!currentUser) {
      setIsAdmin(false)
      return
    }
    const { data, error: rpcError } = await supabase.rpc('is_admin')
    setIsAdmin(!rpcError && data === true)
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return undefined
    }

    const initSession = async () => {
      try {
        const { data } = await authService.getSession()
        const sessionUser = data.session?.user || null
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
      refreshAdminStatus(sessionUser)
      setLoading(false)
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

  const value = useMemo(
    () => ({ user, isAdmin, loading, error, login, register, logout, refreshSession, updateProfile, deleteAccount }),
    [user, isAdmin, loading, error],
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
