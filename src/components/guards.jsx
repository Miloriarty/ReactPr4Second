import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../context/contexts.js'
import { Loader } from './ui.jsx'
import ForbiddenPage from '../pages/ForbiddenPage.jsx'

/*
 * Защита маршрутов. Пока сессия восстанавливается по токену - показываем загрузку,
 * чтобы не выкинуть на страницу входа пользователя, который на самом деле залогинен.
 */

/** Только для авторизованных; гостя отправляет на вход и запоминает, куда он шел. */
export function RequireAuth() {
  const { user, initializing } = useAuth()
  const location = useLocation()
  if (initializing) return <Loader text="Проверяем сессию…" />
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, message: 'Войдите в аккаунт, чтобы открыть эту страницу' }}
      />
    )
  }
  return <Outlet />
}

/** Только для администратора; остальным - страница "Нет доступа". */
export function RequireAdmin() {
  const { isAdmin, initializing } = useAuth()
  if (initializing) return <Loader text="Проверяем сессию…" />
  return isAdmin ? <Outlet /> : <ForbiddenPage />
}

/** Только для гостей (вход, регистрация): залогиненного отправляет туда, куда он шел, или в каталог. */
export function GuestOnly() {
  const { user, initializing } = useAuth()
  const location = useLocation()
  if (initializing) return <Loader text="Проверяем сессию…" />
  if (user) {
    const from = location.state?.from
    return <Navigate to={from ? `${from.pathname}${from.search || ''}` : '/'} replace />
  }
  return <Outlet />
}
