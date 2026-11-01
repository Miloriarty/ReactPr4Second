import { Link, useNavigate } from 'react-router'
import { api } from '../api/client.js'
import { Alert, EmptyState, ErrorMessage, Field, Loader, SubmitButton } from '../components/ui.jsx'
import { useAuth, useCart } from '../context/contexts.js'
import { useForm } from '../hooks/useForm.js'
import { useTitle } from '../hooks/useTitle.js'
import { formatPrice, todayString } from '../utils/format.js'
import { address, futureDate, maxLength, required } from '../utils/validators.js'

const MAX_DAYS_AHEAD = 90

const schema = {
  deliveryAddress: [required('Укажите адрес, куда привезти котиков'), address()],
  deliveryDate: [required('Выберите дату'), futureDate(MAX_DAYS_AHEAD)],
  comment: [maxLength(500)],
}

/**
 * Оформление заказа: адрес и дата доставки (не раньше сегодня).
 * Адрес подставляется из профиля; новый адрес можно сохранить как адрес по умолчанию.
 */
export default function CheckoutPage() {
  useTitle('Оформление заказа')
  const { user, setUser } = useAuth()
  const { cart, ready, error, refresh, setCart } = useCart()
  const navigate = useNavigate()
  const form = useForm(
    { deliveryAddress: user.defaultAddress || '', deliveryDate: '', comment: '', saveAddress: !user.defaultAddress },
    schema,
  )
  const { values, errors } = form

  const submit = form.handleSubmit(async (v) => {
    const order = await api.post('/orders', {
      deliveryAddress: v.deliveryAddress.trim(),
      deliveryDate: v.deliveryDate,
      comment: v.comment.trim(),
      saveAddress: v.saveAddress,
    })
    // сервер уже очистил корзину - синхронизируем локальную копию без лишнего запроса
    setCart({ items: [], total: 0, totalQuantity: 0 })
    // берем адрес из ответа: сервер схлопывает лишние пробелы
    if (v.saveAddress) setUser((u) => ({ ...u, defaultAddress: order.deliveryAddress }))
    navigate('/account', { replace: true, state: { highlightOrder: order.id } })
  })

  if (!ready) return <Loader text="Загружаем корзину…" />
  if (error && cart.items.length === 0) return <ErrorMessage error={error} onRetry={refresh} />
  if (cart.items.length === 0) {
    return (
      <EmptyState title="Нечего оформлять — корзина пуста">
        <Link to="/" className="btn btn--primary">
          Перейти в каталог
        </Link>
      </EmptyState>
    )
  }

  const hasUnavailable = cart.items.some((item) => !item.available)
  const addressDiffers = values.deliveryAddress.trim() !== (user.defaultAddress || '')

  return (
    <>
      <nav className="breadcrumbs">
        <Link to="/cart">← Вернуться в корзину</Link>
      </nav>
      <h1>Оформление заказа</h1>
      <div className="cart">
        <form className="card checkout-form" onSubmit={submit} noValidate>
          {hasUnavailable && (
            <Alert type="warning">
              В корзине есть недоступные услуги. <Link to="/cart">Удалите их</Link>, чтобы продолжить.
            </Alert>
          )}
          <Alert type="error">{form.formError}</Alert>
          <Field
            as="textarea"
            rows={2}
            label="Адрес доставки"
            name="deliveryAddress"
            required
            autoComplete="street-address"
            value={values.deliveryAddress}
            onChange={form.handleChange}
            error={errors.deliveryAddress}
            placeholder="Город, улица, дом, офис/квартира"
          />
          {addressDiffers && values.deliveryAddress.trim() && (
            <label className="checkbox">
              <input type="checkbox" name="saveAddress" checked={values.saveAddress} onChange={form.handleChange} />
              Сохранить как адрес по умолчанию
            </label>
          )}
          <Field
            label="Дата визита"
            name="deliveryDate"
            type="date"
            required
            min={todayString()}
            max={todayString(MAX_DAYS_AHEAD)}
            value={values.deliveryDate}
            onChange={form.handleChange}
            error={errors.deliveryDate}
            hint={`С сегодняшнего дня и до ${MAX_DAYS_AHEAD} дней вперёд`}
          />
          <Field
            as="textarea"
            rows={3}
            label="Комментарий для куратора"
            name="comment"
            maxLength={500}
            value={values.comment}
            onChange={form.handleChange}
            error={errors.comment}
            placeholder="Удобное время, этаж, аллергии у сотрудников…"
          />
          {hasUnavailable ? (
            <button type="button" className="btn btn--primary btn--block" disabled>
              Подтвердить заказ
            </button>
          ) : (
            <SubmitButton submitting={form.submitting} busyText="Оформляем…" className="btn btn--primary btn--block">
              Подтвердить заказ на {formatPrice(cart.total)}
            </SubmitButton>
          )}
        </form>

        <aside className="card cart__summary">
          <h2>Ваш заказ</h2>
          <ul className="summary-list">
            {cart.items.map((item) => (
              <li key={item.id}>
                <span>
                  {item.service.title} × {item.quantity}
                </span>
                <span>{formatPrice(item.subtotal)}</span>
              </li>
            ))}
          </ul>
          <p className="price price--big">{formatPrice(cart.total)}</p>
        </aside>
      </div>
    </>
  )
}
