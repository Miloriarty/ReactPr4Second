import { Link } from 'react-router'
import { formatDuration, formatPrice } from '../utils/format.js'
import AddToCartButton from './AddToCartButton.jsx'
import CatAvatar from './CatAvatar.jsx'
import { Stars } from './ui.jsx'

/** Карточка услуги в каталоге: название, описание, длительность, цена, котики, рейтинг. */
export default function ServiceCard({ service }) {
  return (
    <article className="card service-card">
      <div className="service-card__top">
        <span className="chip">{service.category.name}</span>
        <Stars value={service.rating} count={service.reviewsCount} />
      </div>
      <h3 className="service-card__title">
        <Link to={`/services/${service.id}`}>{service.title}</Link>
      </h3>
      <p className="service-card__desc">{service.description}</p>
      {service.cats.length > 0 && (
        <div className="cat-row" aria-label="Котики на услуге">
          {service.cats.map((cat) => (
            <CatAvatar key={cat.id} cat={cat} size="small" />
          ))}
        </div>
      )}
      <div className="service-card__meta">
        <span>⏱ {formatDuration(service.durationMinutes)}</span>
        <strong className="price">{formatPrice(service.price)}</strong>
      </div>
      <div className="service-card__actions">
        <Link to={`/services/${service.id}`} className="btn btn--ghost">
          Подробнее
        </Link>
        <AddToCartButton service={service} />
      </div>
    </article>
  )
}
