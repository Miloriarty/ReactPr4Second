import { useState } from 'react'
import { api } from '../../api/client.js'
import OrderCard from '../../components/OrderCard.jsx'
import { EmptyState, ErrorMessage, Loader } from '../../components/ui.jsx'
import { useToast } from '../../context/contexts.js'
import { useApi } from '../../hooks/useApi.js'
import { useTitle } from '../../hooks/useTitle.js'
import { DeleteButton, SectionHead } from './AdminLayout.jsx'

/** Заказы всех пользователей: фильтр по статусу, смена статуса, удаление. */
export default function AdminOrders() {
  useTitle('Админка: заказы')
  const [status, setStatus] = useState('')
  const statuses = useApi((signal) => api.get('/order-statuses', null, signal), [])
  const orders = useApi((signal) => api.get('/admin/orders', { status }, signal), [status])

  const replaceOrder = (updated) => orders.setData((list) => list.map((o) => (o.id === updated.id ? updated : o)))

  return (
    <>
      <SectionHead title="Заказы" />
      <label className="sort">
        Статус:{' '}
        <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!statuses.data}>
          <option value="">Все</option>
          {statuses.data?.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <ErrorMessage error={statuses.error} onRetry={statuses.reload} title="Статусы не загрузились" />

      {orders.loading ? (
        <Loader text="Загружаем заказы…" />
      ) : orders.error ? (
        <ErrorMessage error={orders.error} onRetry={orders.reload} />
      ) : orders.data.length === 0 ? (
        <EmptyState title="Заказов нет" />
      ) : (
        <div className="stack">
          {orders.data.map((order) => (
            <OrderCard key={order.id} order={order} showCustomer>
              <div className="order__admin">
                <StatusSelect order={order} statuses={statuses.data || []} onChanged={replaceOrder} />
                <DeleteButton
                  confirmText='Удалить заказ безвозвратно? Обычно достаточно поставить статус "Отменён".'
                  onDelete={async () => {
                    await api.del(`/admin/orders/${order.id}`)
                    orders.setData((list) => list.filter((o) => o.id !== order.id))
                  }}
                />
              </div>
            </OrderCard>
          ))}
        </div>
      )}
    </>
  )
}

/** Выпадающий список смены статуса; сохраняется сразу при выборе. */
function StatusSelect({ order, statuses, onChanged }) {
  const { notifyError } = useToast()
  const [busy, setBusy] = useState(false)

  async function handleChange(e) {
    setBusy(true)
    try {
      const updated = await api.patch(`/admin/orders/${order.id}`, { status: e.target.value })
      onChanged(updated)
    } catch (err) {
      notifyError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className="sort">
      Статус:{' '}
      <select value={order.status.code} onChange={handleChange} disabled={busy || statuses.length === 0}>
        {statuses.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  )
}
