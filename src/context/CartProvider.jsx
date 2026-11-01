import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import { CartContext, useAuth } from './contexts.js'

const EMPTY_CART = { items: [], total: 0, totalQuantity: 0 }

/**
 * Корзина живет на сервере; здесь - ее копия для отображения.
 * Загружается при входе пользователя, у гостя всегда пустая.
 * Каждая операция возвращает с сервера актуальную корзину целиком.
 *
 * Копия помечена владельцем (owner), поэтому после смены пользователя
 * не показывается чужая корзина, а ready = "корзина этого пользователя уже загружена".
 */
export default function CartProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [state, setState] = useState({ owner: null, cart: EMPTY_CART })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const store = useCallback((cart) => setState({ owner: userId, cart }), [userId])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      store(await api.get('/cart'))
    } catch (err) {
      setError(err)
      setState((prev) => ({ owner: userId, cart: prev.owner === userId ? prev.cart : EMPTY_CART }))
    } finally {
      setLoading(false)
    }
  }, [store, userId])

  // Загрузка с сервера при входе/смене пользователя - это и есть синхронизация с внешней системой
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    if (userId) refresh()
  }, [userId, refresh])

  /** Добавить услугу (ошибку пробрасывает вызывающему, чтобы показать ее рядом с кнопкой). */
  const add = useCallback(async (serviceId, quantity = 1) => store(await api.post('/cart', { serviceId, quantity })), [store])

  const updateQuantity = useCallback(
    async (itemId, quantity) => store(await api.patch(`/cart/${itemId}`, { quantity })),
    [store],
  )

  const remove = useCallback(async (itemId) => store(await api.del(`/cart/${itemId}`)), [store])

  const clear = useCallback(async () => store(await api.del('/cart')), [store])

  const cart = userId && state.owner === userId ? state.cart : EMPTY_CART
  const ready = Boolean(userId) && state.owner === userId

  /** Сколько штук услуги уже в корзине - для подсказки на карточке. */
  const quantityOf = useCallback(
    (serviceId) => cart.items.find((item) => item.service.id === serviceId)?.quantity ?? 0,
    [cart],
  )

  const value = useMemo(
    () => ({ cart, loading, ready, error, refresh, add, updateQuantity, remove, clear, quantityOf, setCart: store }),
    [cart, loading, ready, error, refresh, add, updateQuantity, remove, clear, quantityOf, store],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
