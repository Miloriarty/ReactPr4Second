import { Router } from 'express'
import { query } from '../db.js'
import { adminOnly, authRequired, publicUser, USER_SELECT } from '../middleware/auth.js'
import { badRequest, conflict, forbidden, notFound } from '../utils/HttpError.js'
import { parseId, validate } from '../utils/validation.js'
import { ORDER_SELECT } from './orders.js'

/*
 * Админка: заказы всех пользователей и управление пользователями.
 * Услуги, категории, котики и отзывы администрируются в своих маршрутах.
 * Роли и статусы - справочники, администратор их не меняет.
 */
const router = Router()
router.use(authRequired, adminOnly)

/** GET /api/admin/orders?status=<code> - все заказы. */
router.get('/orders', async (req, res) => {
  const f = validate(req.query, { status: { type: 'string', max: 20 } })
  const { rows } = f.status
    ? await query(`${ORDER_SELECT} WHERE st.code = $1 ORDER BY o.created_at DESC`, [f.status])
    : await query(`${ORDER_SELECT} ORDER BY o.created_at DESC`)
  res.json(rows)
})

/** PATCH /api/admin/orders/:id - смена статуса заказа. Тело: { status: <code> }. */
router.patch('/orders/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const d = validate(req.body, { status: { type: 'string', required: true, max: 20 } })
  const status = await query('SELECT id FROM order_statuses WHERE code = $1', [d.status])
  if (status.rowCount === 0) throw badRequest('Неизвестный статус', { status: 'Выберите статус из списка' })

  const { rowCount } = await query('UPDATE orders SET status_id = $1 WHERE id = $2', [status.rows[0].id, id])
  if (rowCount === 0) throw notFound('Заказ не найден')
  const { rows } = await query(`${ORDER_SELECT} WHERE o.id = $1`, [id])
  res.json(rows[0])
})

/** DELETE /api/admin/orders/:id - удалить заказ. */
router.delete('/orders/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const { rowCount } = await query('DELETE FROM orders WHERE id = $1', [id])
  if (rowCount === 0) throw notFound('Заказ не найден')
  res.status(204).end()
})

/** GET /api/admin/users - список пользователей с количеством заказов. */
router.get('/users', async (req, res) => {
  const { rows } = await query(`
    SELECT u.id, u.full_name, u.email, u.phone, u.default_address, u.created_at,
           r.code AS role_code, r.name AS role_name, COUNT(o.id)::int AS orders_count
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN orders o ON o.user_id = u.id
    GROUP BY u.id, r.id
    ORDER BY u.created_at DESC`)
  res.json(rows.map((row) => ({ ...publicUser(row), ordersCount: row.orders_count })))
})

/** PUT /api/admin/users/:id - изменить данные пользователя (роль менять нельзя). */
router.put('/users/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const d = validate(req.body, {
    fullName: { type: 'name', required: true },
    email: { type: 'email', required: true },
    phone: { type: 'phone', required: true },
    defaultAddress: { type: 'address' },
  })
  const taken = await query('SELECT 1 FROM users WHERE email = $1 AND id <> $2', [d.email, id])
  if (taken.rowCount > 0) throw conflict('Этот email уже используется', { email: 'Email уже занят' })

  const { rowCount } = await query(
    'UPDATE users SET full_name = $1, email = $2, phone = $3, default_address = $4 WHERE id = $5',
    [d.fullName, d.email, d.phone, d.defaultAddress, id],
  )
  if (rowCount === 0) throw notFound('Пользователь не найден')
  const { rows } = await query(`${USER_SELECT} WHERE u.id = $1`, [id])
  res.json(publicUser(rows[0]))
})

/** DELETE /api/admin/users/:id - удалить пользователя (не себя и не другого администратора). */
router.delete('/users/:id', async (req, res) => {
  const id = parseId(req.params.id)
  if (id === req.user.id) throw forbidden('Нельзя удалить собственную учётную запись')
  const { rows } = await query(`${USER_SELECT} WHERE u.id = $1`, [id])
  if (rows.length === 0) throw notFound('Пользователь не найден')
  if (rows[0].role_code === 'admin') throw forbidden('Нельзя удалить администратора')

  await query('DELETE FROM users WHERE id = $1', [id])
  res.status(204).end()
})

export default router
