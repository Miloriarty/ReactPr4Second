import { Link } from 'react-router'
import { api } from '../../api/client.js'
import { EmptyState, ErrorMessage, Loader, Stars } from '../../components/ui.jsx'
import { useApi } from '../../hooks/useApi.js'
import { useTitle } from '../../hooks/useTitle.js'
import { formatDateTime } from '../../utils/format.js'
import { DeleteButton, SectionHead } from './AdminLayout.jsx'

/** Модерация отзывов: все отзывы по всем услугам с возможностью удаления. */
export default function AdminReviews() {
  useTitle('Админка: отзывы')
  const reviews = useApi((signal) => api.get('/reviews', null, signal), [])

  if (reviews.loading && !reviews.data) return <Loader text="Загружаем отзывы…" />
  if (reviews.error) return <ErrorMessage error={reviews.error} onRetry={reviews.reload} />

  return (
    <>
      <SectionHead title="Отзывы" />
      {reviews.data.length === 0 ? (
        <EmptyState title="Отзывов пока нет" />
      ) : (
        <ul className="reviews">
          {reviews.data.map((r) => (
            <li key={r.id} className="review card">
              <div className="review__head">
                <strong>{r.authorName}</strong>
                <span className="muted">о</span>
                <Link to={`/services/${r.service.id}`}>{r.service.title}</Link>
                <Stars value={r.rating} />
                <span className="muted">{formatDateTime(r.createdAt)}</span>
              </div>
              <p>{r.comment}</p>
              <div className="review__actions">
                <DeleteButton
                  confirmText={`Удалить отзыв пользователя ${r.authorName}?`}
                  onDelete={async () => {
                    await api.del(`/reviews/${r.id}`)
                    reviews.setData((list) => list.filter((x) => x.id !== r.id))
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
