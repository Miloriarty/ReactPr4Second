import { Link } from 'react-router'
import { EmptyState } from '../components/ui.jsx'
import { useTitle } from '../hooks/useTitle.js'

/** 404 - несуществующий адрес. */
export default function NotFoundPage() {
  useTitle('Страница не найдена')
  return (
    <EmptyState title="Страница не найдена">
      <p>Похоже, котик уронил эту страницу со стола.</p>
      <Link to="/" className="btn btn--primary">
        На главную
      </Link>
    </EmptyState>
  )
}
