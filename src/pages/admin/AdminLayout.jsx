import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useToast } from '../../context/contexts.js'

/** Админ-панель: вкладки по сущностям, которыми управляет администратор. */
export default function AdminLayout() {
  return (
    <>
      <h1>Администрирование</h1>
      <nav className="tabs" aria-label="Разделы админки">
        <NavLink to="/admin" end>
          Заказы
        </NavLink>
        <NavLink to="/admin/services">Услуги</NavLink>
        <NavLink to="/admin/categories">Категории</NavLink>
        <NavLink to="/admin/cats">Котики</NavLink>
        <NavLink to="/admin/users">Пользователи</NavLink>
        <NavLink to="/admin/reviews">Отзывы</NavLink>
      </nav>
      <Outlet />
    </>
  )
}

/**
 * Кнопка удаления с подтверждением, блокировкой на время запроса и уведомлением об ошибке.
 * onDelete - async-функция, которая выполняет запрос и обновляет список.
 */
export function DeleteButton({ onDelete, confirmText, disabled, title }) {
  const { notifyError } = useToast()
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    if (!window.confirm(confirmText)) return
    setBusy(true)
    try {
      await onDelete()
    } catch (err) {
      notifyError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="btn btn--danger btn--small"
      onClick={handleClick}
      disabled={busy || disabled}
      title={title}
    >
      {busy ? 'Удаляем…' : 'Удалить'}
    </button>
  )
}

/** Шапка раздела админки: заголовок и кнопка "Добавить". */
export function SectionHead({ title, onAdd, addText = 'Добавить' }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {onAdd && (
        <button type="button" className="btn btn--primary" onClick={onAdd}>
          + {addText}
        </button>
      )}
    </div>
  )
}
