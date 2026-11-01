import { formatDate, formatDateTime, formatPrice } from '../utils/format.js'
import { StatusBadge } from './ui.jsx'

/**
 * Карточка заказа: даты, адрес, статус, позиции, сумма.
 * children - дополнительные действия (отмена для пользователя, смена статуса для админа).
 */
export default function OrderCard({ order, highlight = false, showCustomer = false, children }) {
  return (
    <article className={`card order${highlight ? ' order--new' : ''}`}>
      <header className="order__head">
        <div>
          <strong>Заказ от {formatDateTime(order.createdAt)}</strong>
          {highlight && <span className="chip">Только что оформлен</span>}
        </div>
        <StatusBadge status={order.status} />
      </header>
      <dl className="props props--compact">
        <div>
          <dt>Дата визита</dt>
          <dd>{formatDate(order.deliveryDate)}</dd>
        </div>
        <div>
          <dt>Адрес</dt>
          <dd>{order.deliveryAddress}</dd>
        </div>
        {showCustomer && (
          <div>
            <dt>Заказчик</dt>
            <dd>
              {order.customer.fullName}
              <br />
              <span className="muted small">
                {order.customer.phone} · {order.customer.email}
              </span>
            </dd>
          </div>
        )}
        {order.comment && (
          <div>
            <dt>Комментарий</dt>
            <dd>{order.comment}</dd>
          </div>
        )}
      </dl>
      <ul className="summary-list">
        {order.items.map((item) => (
          <li key={item.id}>
            <span>
              {item.title} × {item.quantity}
            </span>
            <span>{formatPrice(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <footer className="order__foot">
        <strong className="price">Итого: {formatPrice(order.total)}</strong>
        {children}
      </footer>
    </article>
  )
}
