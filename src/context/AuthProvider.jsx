import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, setUnauthorizedHandler, tokenStorage } from '../api/client.js'
import { AuthContext } from './contexts.js'

/**
 * Хранит текущего пользователя. При загрузке страницы восстанавливает сессию
 * по сохраненному токену (GET /auth/me). Если сервер ответил 401 на любой запрос -
 * сессия сбрасывается, а на странице входа показывается sessionMessage.
 */
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(() => Boolean(tokenStorage.get()))
  const [initError, setInitError] = useState(null)
  const [sessionMessage, setSessionMessage] = useState(null)
  const [attempt, setAttempt] = useState(0)

  // Восстановление сессии по токену
  useEffect(() => {
    if (!tokenStorage.get()) return
    let cancelled = false
    api
      .get('/auth/me')
      .then((data) => !cancelled && setUser(data.user))
      .catch((err) => {
        if (cancelled) return
        if (err.status === 401) tokenStorage.clear()
        else setInitError(err) // сервер недоступен - не выкидываем пользователя, а предлагаем повторить
      })
      .finally(() => !cancelled && setInitializing(false))
    return () => {
      cancelled = true
    }
  }, [attempt])

  // Любой 401 с токеном = сессия истекла или пароль сменили на другом устройстве
  useEffect(() => {
    setUnauthorizedHandler((message) => {
      tokenStorage.clear()
      setUser(null)
      setSessionMessage(message)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  /** Сохраняет ответ { token, user } от входа/регистрации/восстановления пароля. */
  const applyAuth = useCallback(({ token, user: nextUser }) => {
    tokenStorage.set(token)
    setUser(nextUser)
    setSessionMessage(null)
  }, [])

  const login = useCallback(
    async (email, password) => {
      const data = await api.post('/auth/login', { email, password })
      applyAuth(data)
      return data.user
    },
    [applyAuth],
  )

  const register = useCallback(
    async (form) => {
      const data = await api.post('/auth/register', form)
      applyAuth(data)
      return data.user
    },
    [applyAuth],
  )

  /** Выход: токен на сервере не хранится, поэтому достаточно удалить его у себя. */
  const logout = useCallback(() => {
    tokenStorage.clear()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAdmin: user?.role === 'admin',
      initializing,
      initError,
      retryInit: () => {
        setInitializing(true)
        setInitError(null)
        setAttempt((n) => n + 1)
      },
      sessionMessage,
      clearSessionMessage: () => setSessionMessage(null),
      login,
      register,
      logout,
      applyAuth,
      setUser,
      setToken: tokenStorage.set,
    }),
    [user, initializing, initError, sessionMessage, login, register, logout, applyAuth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
