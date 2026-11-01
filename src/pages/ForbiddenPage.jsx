import { Link } from 'react-router'
import { EmptyState } from '../components/ui.jsx'
import { useTitle } from '../hooks/useTitle.js'

/** 403 - раздел только для администратора. */
export default function ForbiddenPage() {
  useTitle('Нет доступа')
  return (
    <EmptyState title="Нет доступа">
      <p>Этот раздел доступен только администратору.</p>
      <Link to="/" className="btn btn--primary">
        В каталог
      </Link>
    </EmptyState>
  )
}
