import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../../context/contexts.js'

/** Личный кабинет: вкладки "Заказы", "Личные данные", "Пароль". */
export default function AccountLayout() {
  const { user } = useAuth()
  return (
    <>
      <h1>Личный кабинет</h1>
      <p className="lead">
        {user.fullName} · {user.email}
      </p>
      <nav className="tabs" aria-label="Разделы кабинета">
        <NavLink to="/account" end>
          Мои заказы
        </NavLink>
        <NavLink to="/account/profile">Личные данные</NavLink>
        <NavLink to="/account/password">Смена пароля</NavLink>
      </nav>
      <Outlet />
    </>
  )
}
