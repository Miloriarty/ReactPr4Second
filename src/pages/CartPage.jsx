import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Alert, EmptyState, ErrorMessage, Loader } from '../components/ui.jsx'
import { useCart, useToast } from '../context/contexts.js'
import { useTitle } from '../hooks/useTitle.js'
import { formatDuration, formatPrice, plural } from '../utils/format.js'

/** Корзина: список услуг, изменение количества, удаление, итог и переход к оформлению. */
export default function CartPage() {
  useTitle('Корзина')
  const { cart, ready, error, refresh, clear } = useCart()
  const { notifyError } = useToast()
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleClear() {
    if (!window.confirm('Удалить из корзины все услуги?')) return
    setClearing(true)
    try {
      await clear()
    } catch (err) {
      notifyError(err.message)
    } finally {
      setClearing(false)
    }
  }

  if (!ready) return <Loader text="Загружаем корзину…" />
  if (error && cart.items.length === 0) return <ErrorMessage error={error} onRetry={refresh} />

  if (cart.items.length === 0) {
    return (
      <EmptyState title="Корзина пуста">
        <p>Выберите услугу в каталоге — котики уже ждут.</p>
        <Link to="/" className="btn btn--primary">
          Перейти в каталог
        </Link>
      </EmptyState>
    )
  }

  const unavailable = cart.items.filter((item) => !item.available)

  return (
    <>
      <h1>Корзина</h1>
      <ErrorMessage error={error} onRetry={refresh} title="Не удалось обновить корзину" />
      {unavailable.length > 0 && (
        <Alert type="warning">
          Некоторые услуги больше недоступны. Удалите их из корзины, чтобы оформить заказ.
        </Alert>
      )}
      <div className="cart">
        <ul className="cart__items">
          {cart.items.map((item) => (
            <CartItem key={item.id} item={item} />
          ))}
        </ul>
        <aside className="card cart__summary">
          <h2>Итого</h2>
          <p>
            {cart.totalQuantity} {plural(cart.totalQuantity, ['услуга', 'услуги', 'услуг'])}
          </p>
          <p className="price price--big">{formatPrice(cart.total)}</p>
          {unavailable.length > 0 ? (
            <button type="button" className="btn btn--primary btn--block" disabled>
              Оформить заказ
            </button>
          ) : (
            <Link to="/checkout" className="btn btn--primary btn--block">
              Оформить заказ
            </Link>
          )}
          <Link to="/" className="btn btn--ghost btn--block">
            Продолжить выбор
          </Link>
          <button type="button" className="btn btn--link" onClick={handleClear} disabled={clearing}>
            {clearing ? 'Очищаем…' : 'Очистить корзину'}
          </button>
        </aside>
      </div>
    </>
  )
}

/** Строка корзины с выбором количества и удалением. */
function CartItem({ item }) {
  const { updateQuantity, remove } = useCart()
  const { notifyError } = useToast()
  const [busy, setBusy] = useState(false)

  /** Выполняет действие с позицией, блокируя ее на время запроса. */
  async function run(action) {
    setBusy(true)
    try {
      await action()
    } catch (err) {
      notifyError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`card cart-item${item.available ? '' : ' cart-item--off'}${busy ? ' is-busy' : ''}`}>
      <div className="cart-item__info">
        {item.available ? (
          <Link to={`/services/${item.service.id}`} className="cart-item__title">
            {item.service.title}
          </Link>
        ) : (
          <span className="cart-item__title">{item.service.title}</span>
        )}
        <span className="muted small">
          {item.service.category} · {formatDuration(item.service.durationMinutes)} · {formatPrice(item.service.price)} за шт.
        </span>
        {!item.available && <span className="field__error">Услуга недоступна для заказа</span>}
      </div>
      <label className="cart-item__qty">
        <span className="visually-hidden">Количество</span>
        <select
          value={item.quantity}
          disabled={busy || !item.available}
          onChange={(e) => run(() => updateQuantity(item.id, Number(e.target.value)))}
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} шт.
            </option>
          ))}
        </select>
      </label>
      <strong className="cart-item__sum">{formatPrice(item.subtotal)}</strong>
      <button
        type="button"
        className="btn btn--danger btn--small"
        disabled={busy}
        onClick={() => run(() => remove(item.id))}
      >
        Удалить
      </button>
    </li>
  )
}
