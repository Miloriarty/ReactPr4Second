import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth, useCart, useToast } from '../context/contexts.js'

const MAX_QUANTITY = 10

/**
 * Кнопка "В корзину". Гостя отправляет на вход (и возвращает обратно после входа),
 * не дает превысить лимит 10 шт. и показывает, сколько уже лежит в корзине.
 */
export default function AddToCartButton({ service, quantity = 1, className = 'btn btn--primary' }) {
  const { user } = useAuth()
  const { add, quantityOf } = useCart()
  const { notifyError } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)

  const inCart = user ? quantityOf(service.id) : 0
  const limitReached = inCart + quantity > MAX_QUANTITY

  async function handleClick() {
    if (!user) {
      navigate('/login', { state: { from: location, message: 'Войдите, чтобы добавить услугу в корзину' } })
      return
    }
    setBusy(true)
    try {
      await add(service.id, quantity)
    } catch (err) {
      notifyError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="add-to-cart">
      <button
        type="button"
        className={className}
        onClick={handleClick}
        disabled={busy || limitReached}
        title={limitReached ? `Не больше ${MAX_QUANTITY} шт. одной услуги` : undefined}
      >
        {busy ? 'Добавляем…' : limitReached ? 'Достигнут лимит' : 'В корзину'}
      </button>
      {inCart > 0 && <span className="add-to-cart__info">В корзине: {inCart}</span>}
    </div>
  )
}
