import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth, useCart } from '../context/contexts.js'
import ThemeToggle from './ThemeToggle.jsx'
import { ErrorMessage, Loader } from './ui.jsx'

const YEAR = new Date().getFullYear()

/** Общий каркас страниц: шапка с навигацией, содержимое, подвал. */
export default function Layout() {
  const { initError, retryInit, initializing } = useAuth()

  return (
    <div className="app">
      <Header />
      <main className="container main">
        {initError && !initializing ? (
          <ErrorMessage error={initError} onRetry={retryInit} title="Не удалось проверить вашу сессию" />
        ) : initializing ? (
          <Loader text="Проверяем сессию…" />
        ) : (
          <Outlet />
        )}
      </main>
      <footer className="footer">
        <div className="container">© {YEAR} Котики-терапевты на выезд · Мурчим с заботой</div>
      </footer>
    </div>
  )
}

/** Шапка: навигация зависит от роли; у вошедшего - кнопка выхода. */
function Header() {
  const { user, isAdmin, logout } = useAuth()
  const { cart } = useCart()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <header className="header">
      <div className="container header__inner">
        <Link to="/" className="logo">
          Котики-терапевты
        </Link>
        <nav className="nav" aria-label="Основная навигация">
          <NavLink to="/" end>
            Услуги
          </NavLink>
          <NavLink to="/cats">Наши котики</NavLink>
          {user && (
            <NavLink to="/cart">
              Корзина
              {cart.totalQuantity > 0 && <span className="nav__count">{cart.totalQuantity}</span>}
            </NavLink>
          )}
          {user && <NavLink to="/account">Кабинет</NavLink>}
          {isAdmin && <NavLink to="/admin">Админка</NavLink>}
        </nav>
        <div className="header__user">
          <ThemeToggle />
          {user ? (
            <>
              <span className="header__name" title={user.email}>
                {user.fullName}
              </span>
              <button type="button" className="btn btn--ghost btn--small" onClick={handleLogout}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn--ghost btn--small">
                Войти
              </Link>
              <Link to="/register" className="btn btn--primary btn--small">
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
