import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { api } from '../../api/client.js'
import OrderCard from '../../components/OrderCard.jsx'
import { EmptyState, ErrorMessage, Loader } from '../../components/ui.jsx'
import { useToast } from '../../context/contexts.js'
import { useApi } from '../../hooks/useApi.js'
import { useTitle } from '../../hooks/useTitle.js'

/** Все заказы пользователя: дата, адрес, статус; новый заказ можно отменить. */
export default function OrdersTab() {
  useTitle('Мои заказы')
  const location = useLocation()
  const orders = useApi((signal) => api.get('/orders', null, signal), [])

  if (orders.loading) return <Loader text="Загружаем заказы…" />
  if (orders.error) return <ErrorMessage error={orders.error} onRetry={orders.reload} />
  if (orders.data.length === 0) {
    return (
      <EmptyState title="Заказов пока нет">
        <p>Выберите услугу в каталоге и оформите первый заказ.</p>
        <Link to="/" className="btn btn--primary">
          В каталог
        </Link>
      </EmptyState>
    )
  }

  /** Подменяет заказ в списке после отмены, не перезагружая весь список. */
  const replaceOrder = (updated) => orders.setData((list) => list.map((o) => (o.id === updated.id ? updated : o)))

  return (
    <div className="stack">
      {orders.data.map((order) => (
        <OrderCard key={order.id} order={order} highlight={location.state?.highlightOrder === order.id}>
          {order.status.code === 'new' && <CancelButton order={order} onCancelled={replaceOrder} />}
        </OrderCard>
      ))}
    </div>
  )
}

/** Отмена заказа с подтверждением. */
function CancelButton({ order, onCancelled }) {
  const { notifyError } = useToast()
  const [busy, setBusy] = useState(false)

  async function handleCancel() {
    if (!window.confirm('Отменить заказ? Котики останутся дома.')) return
    setBusy(true)
    try {
      onCancelled(await api.post(`/orders/${order.id}/cancel`))
    } catch (err) {
      notifyError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className="btn btn--danger btn--small" onClick={handleCancel} disabled={busy}>
      {busy ? 'Отменяем…' : 'Отменить заказ'}
    </button>
  )
}
