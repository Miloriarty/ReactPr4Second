import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { api } from '../api/client.js'
import AddToCartButton from '../components/AddToCartButton.jsx'
import CatAvatar from '../components/CatAvatar.jsx'
import { Alert, EmptyState, ErrorMessage, Field, Loader, StarInput, Stars, SubmitButton } from '../components/ui.jsx'
import { useAuth, useToast } from '../context/contexts.js'
import { useApi } from '../hooks/useApi.js'
import { useForm } from '../hooks/useForm.js'
import { useTitle } from '../hooks/useTitle.js'
import { formatDateTime, formatDuration, formatPrice } from '../utils/format.js'
import { maxLength, minLength, required } from '../utils/validators.js'

/** Страница услуги: описание, котики-исполнители, добавление в корзину и отзывы. */
export default function ServicePage() {
  const { id } = useParams()
  const service = useApi((signal) => api.get(`/services/${id}`, null, signal), [id])
  const reviews = useApi((signal) => api.get(`/services/${id}/reviews`, null, signal), [id])
  const [quantity, setQuantity] = useState(1)
  useTitle(service.data?.title || 'Услуга')

  if (service.loading) return <Loader text="Загружаем услугу…" />
  if (service.error) {
    return service.error.status === 404 || service.error.status === 400 ? (
      <EmptyState title="Услуга не найдена">
        <p>Возможно, её убрали из каталога.</p>
        <Link to="/" className="btn btn--primary">
          Перейти в каталог
        </Link>
      </EmptyState>
    ) : (
      <ErrorMessage error={service.error} onRetry={service.reload} />
    )
  }

  const s = service.data
  return (
    <>
      <nav className="breadcrumbs">
        <Link to="/">Услуги</Link> / <Link to={`/?category=${s.category.slug}`}>{s.category.name}</Link>
      </nav>

      <article className="card service-detail">
        {!s.isActive && <Alert type="warning">Услуга скрыта из каталога (видна только администратору)</Alert>}
        <h1>{s.title}</h1>
        <Stars value={s.rating} count={s.reviewsCount} />
        <p className="service-detail__desc">{s.description}</p>
        <dl className="props">
          <div>
            <dt>Длительность</dt>
            <dd>{formatDuration(s.durationMinutes)}</dd>
          </div>
          <div>
            <dt>Цена</dt>
            <dd className="price">{formatPrice(s.price)}</dd>
          </div>
          <div>
            <dt>Категория</dt>
            <dd>{s.category.name}</dd>
          </div>
        </dl>

        {s.isActive && (
          <div className="buy-row">
            <label>
              Количество{' '}
              <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <span className="muted">Итого: {formatPrice(s.price * quantity)}</span>
            <AddToCartButton service={s} quantity={quantity} />
          </div>
        )}
      </article>

      {s.cats.length > 0 && (
        <section className="section">
          <h2>Кто приедет</h2>
          <div className="cat-row cat-row--big">
            {s.cats.map((cat) => (
              <Link to="/cats" key={cat.id} className="cat-chip">
                <CatAvatar cat={cat} />
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Reviews serviceId={s.id} reviews={reviews} canReview={s.isActive} onChanged={service.reload} />
    </>
  )
}

/** Блок отзывов: список всех отзывов и форма для авторизованного пользователя. */
function Reviews({ serviceId, reviews, canReview, onChanged }) {
  const { user } = useAuth()
  const location = useLocation()
  const [editing, setEditing] = useState(false)

  const list = reviews.data || []
  const mine = list.find((r) => r.isMine)

  /** После любых изменений перезагружаем и отзывы, и услугу (у нее меняется рейтинг). */
  function afterChange() {
    setEditing(false)
    reviews.reload()
    onChanged()
  }

  return (
    <section className="section">
      <h2>
        Отзывы {list.length > 0 && <span className="muted">{list.length}</span>}
      </h2>

      {!user ? (
        <Alert type="info">
          Оставлять отзывы могут только зарегистрированные пользователи.{' '}
          <Link to="/login" state={{ from: location, message: 'Войдите, чтобы оставить отзыв' }}>
            Войти
          </Link>{' '}
          или <Link to="/register">зарегистрироваться</Link>.
        </Alert>
      ) : reviews.loading ? null : !mine && canReview ? (
        <ReviewForm serviceId={serviceId} onSaved={afterChange} />
      ) : mine && editing ? (
        <ReviewForm serviceId={serviceId} review={mine} onSaved={afterChange} onCancel={() => setEditing(false)} />
      ) : null}

      {reviews.loading ? (
        <Loader text="Загружаем отзывы…" />
      ) : reviews.error ? (
        <ErrorMessage error={reviews.error} onRetry={reviews.reload} title="Отзывы не загрузились" />
      ) : list.length === 0 ? (
        <p className="muted">Отзывов пока нет - станьте первым!</p>
      ) : (
        <ul className="reviews">
          {list.map((review) => (
            <ReviewItem key={review.id} review={review} onEdit={() => setEditing(true)} onDeleted={afterChange} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** Один отзыв; у своего (или у любого для админа) - кнопки управления. */
function ReviewItem({ review, onEdit, onDeleted }) {
  const { isAdmin } = useAuth()
  const { notifyError } = useToast()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!window.confirm('Удалить отзыв? Это действие нельзя отменить.')) return
    setDeleting(true)
    try {
      await api.del(`/reviews/${review.id}`)
      onDeleted()
    } catch (err) {
      notifyError(err.message)
      setDeleting(false)
    }
  }

  return (
    <li className={`review card${review.isMine ? ' review--mine' : ''}`}>
      <div className="review__head">
        <strong>{review.authorName}</strong>
        {review.isMine && <span className="chip">Ваш отзыв</span>}
        <Stars value={review.rating} />
        <span className="muted">{formatDateTime(review.createdAt)}</span>
      </div>
      <p>{review.comment}</p>
      {(review.isMine || isAdmin) && (
        <div className="review__actions">
          {review.isMine && (
            <button type="button" className="btn btn--ghost btn--small" onClick={onEdit}>
              Редактировать
            </button>
          )}
          <button type="button" className="btn btn--danger btn--small" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Удаляем…' : 'Удалить'}
          </button>
        </div>
      )}
    </li>
  )
}

const reviewSchema = {
  rating: [(v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? null : 'Поставьте оценку от 1 до 5')],
  comment: [required('Напишите пару слов'), minLength(3), maxLength(1000)],
}

/** Форма нового отзыва или редактирования своего. */
function ReviewForm({ serviceId, review, onSaved, onCancel }) {
  const form = useForm({ rating: review?.rating ?? 0, comment: review?.comment ?? '' }, reviewSchema)
  const { values, errors } = form

  const submit = form.handleSubmit(async (v) => {
    const body = { rating: v.rating, comment: v.comment.trim() }
    if (review) await api.put(`/reviews/${review.id}`, body)
    else await api.post(`/services/${serviceId}/reviews`, body)
    onSaved()
  })

  return (
    <form className="card review-form" onSubmit={submit} noValidate>
      <h3>{review ? 'Редактировать отзыв' : 'Оставить отзыв'}</h3>
      <Alert type="error">{form.formError}</Alert>
      <StarInput
        value={values.rating}
        error={errors.rating}
        onChange={(rating) => form.handleChange({ target: { name: 'rating', value: rating } })}
      />
      <Field
        as="textarea"
        label="Комментарий"
        name="comment"
        required
        rows={4}
        maxLength={1000}
        value={values.comment}
        onChange={form.handleChange}
        error={errors.comment}
        hint={`${values.comment.length}/1000`}
      />
      <div className="form-actions">
        <SubmitButton submitting={form.submitting}>{review ? 'Сохранить' : 'Отправить отзыв'}</SubmitButton>
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Отмена
          </button>
        )}
      </div>
    </form>
  )
}
