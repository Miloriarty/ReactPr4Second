import { Router } from 'express'
import { query, withTransaction } from '../db.js'
import { authRequired } from '../middleware/auth.js'
import { badRequest, conflict, notFound } from '../utils/HttpError.js'
import { parseId, validate } from '../utils/validation.js'

const router = Router()

/**
 * SELECT заказа: статус (JOIN order_statuses), позиции (JOIN order_items)
 * и заказчик (JOIN users) - для админки.
 */
export const ORDER_SELECT = `
  SELECT o.id, o.delivery_address AS "deliveryAddress", o.delivery_date AS "deliveryDate",
         o.comment, o.total, o.created_at AS "createdAt",
         json_build_object('code', st.code, 'name', st.name) AS status,
         json_build_object('fullName', u.full_name, 'email', u.email, 'phone', u.phone) AS customer,
         COALESCE(i.items, '[]') AS items
  FROM orders o
  JOIN order_statuses st ON st.id = o.status_id
  JOIN users u ON u.id = o.user_id
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object(
             'id', oi.id, 'serviceId', oi.service_id, 'title', oi.title, 'price', oi.price,
             'durationMinutes', oi.duration_minutes, 'quantity', oi.quantity
           ) ORDER BY oi.id) AS items
    FROM order_items oi WHERE oi.order_id = o.id
  ) i ON TRUE`

/** GET /api/order-statuses - справочник статусов (для фильтров и админки). */
router.get('/order-statuses', async (req, res) => {
  const { rows } = await query('SELECT code, name FROM order_statuses ORDER BY sort_order')
  res.json(rows)
})

/** GET /api/orders - все заказы текущего пользователя, новые сверху. */
router.get('/orders', authRequired, async (req, res) => {
  const { rows } = await query(`${ORDER_SELECT} WHERE o.user_id = $1 ORDER BY o.created_at DESC`, [req.user.id])
  res.json(rows)
})

/** GET /api/orders/:id - один свой заказ. */
router.get('/orders/:id', authRequired, async (req, res) => {
  const id = parseId(req.params.id)
  const { rows } = await query(`${ORDER_SELECT} WHERE o.id = $1 AND o.user_id = $2`, [id, req.user.id])
  if (rows.length === 0) throw notFound('Заказ не найден')
  res.json(rows[0])
})

/**
 * POST /api/orders - оформление заказа из корзины.
 * Тело: { deliveryAddress, deliveryDate: 'YYYY-MM-DD', comment?, saveAddress? }.
 * Дата не раньше сегодняшней и не позже чем через 90 дней.
 * В одной транзакции: создается заказ, позиции копируются из корзины, корзина очищается.
 */
router.post('/orders', authRequired, async (req, res) => {
  const d = validate(req.body, {
    deliveryAddress: { type: 'address', required: true },
    deliveryDate: { type: 'date', required: true, notPast: true, maxDaysAhead: 90 },
    comment: { type: 'string', max: 500 },
    saveAddress: { type: 'bool', default: false },
  })

  const orderId = await withTransaction(async (client) => {
    // блокируем строки корзины, чтобы двойной клик не создал два заказа
    const cart = await client.query(
      `SELECT ci.id, s.title, s.is_active
       FROM cart_items ci JOIN services s ON s.id = ci.service_id
       WHERE ci.user_id = $1 FOR UPDATE OF ci`,
      [req.user.id],
    )
    if (cart.rowCount === 0) throw badRequest('Корзина пуста — добавьте услуги из каталога')
    const unavailable = cart.rows.filter((row) => !row.is_active).map((row) => row.title)
    if (unavailable.length > 0) {
      throw badRequest(`Услуги больше недоступны, удалите их из корзины: ${unavailable.join(', ')}`)
    }

    const { rows } = await client.query(
      `INSERT INTO orders (user_id, status_id, delivery_address, delivery_date, comment, total)
       SELECT $1, (SELECT id FROM order_statuses WHERE code = 'new'), $2, $3, $4, SUM(s.price * ci.quantity)
       FROM cart_items ci JOIN services s ON s.id = ci.service_id
       WHERE ci.user_id = $1
       RETURNING id`,
      [req.user.id, d.deliveryAddress, d.deliveryDate, d.comment],
    )
    await client.query(
      `INSERT INTO order_items (order_id, service_id, title, price, duration_minutes, quantity)
       SELECT $1, s.id, s.title, s.price, s.duration_minutes, ci.quantity
       FROM cart_items ci JOIN services s ON s.id = ci.service_id
       WHERE ci.user_id = $2
       ORDER BY ci.added_at`,
      [rows[0].id, req.user.id],
    )
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id])
    if (d.saveAddress) {
      await client.query('UPDATE users SET default_address = $1 WHERE id = $2', [d.deliveryAddress, req.user.id])
    }
    return rows[0].id
  })

  const { rows } = await query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId])
  res.status(201).json(rows[0])
})

/** POST /api/orders/:id/cancel - пользователь может отменить свой заказ, пока он в статусе "Новый". */
router.post('/orders/:id/cancel', authRequired, async (req, res) => {
  const id = parseId(req.params.id)
  const { rows } = await query(
    `SELECT st.code FROM orders o JOIN order_statuses st ON st.id = o.status_id
     WHERE o.id = $1 AND o.user_id = $2`,
    [id, req.user.id],
  )
  if (rows.length === 0) throw notFound('Заказ не найден')
  if (rows[0].code !== 'new') throw conflict('Отменить можно только новый заказ. Свяжитесь с куратором')

  await query(`UPDATE orders SET status_id = (SELECT id FROM order_statuses WHERE code = 'cancelled') WHERE id = $1`, [id])
  const updated = await query(`${ORDER_SELECT} WHERE o.id = $1`, [id])
  res.json(updated.rows[0])
})

export default router
