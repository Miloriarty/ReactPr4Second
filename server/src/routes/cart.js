import { Router } from 'express'
import { query } from '../db.js'
import { authRequired } from '../middleware/auth.js'
import { badRequest, notFound } from '../utils/HttpError.js'
import { parseId, validate } from '../utils/validation.js'

const router = Router()
router.use(authRequired)

const MAX_QUANTITY = 10

/**
 * Загружает корзину пользователя (JOIN services + categories) и считает итог.
 * Скрытые администратором услуги помечаются available: false - их нельзя оформить.
 */
export async function loadCart(userId, db = { query }) {
  const { rows } = await db.query(
    `SELECT ci.id, ci.quantity, ci.added_at AS "addedAt",
            json_build_object(
              'id', s.id, 'title', s.title, 'price', s.price,
              'durationMinutes', s.duration_minutes, 'imageUrl', s.image_url,
              'category', c.name
            ) AS service,
            s.is_active AS available,
            (s.price * ci.quantity)::float AS subtotal
     FROM cart_items ci
     JOIN services s ON s.id = ci.service_id
     JOIN categories c ON c.id = s.category_id
     WHERE ci.user_id = $1
     ORDER BY ci.added_at`,
    [userId],
  )
  const available = rows.filter((item) => item.available)
  return {
    items: rows,
    totalQuantity: available.reduce((sum, item) => sum + item.quantity, 0),
    total: Math.round(available.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100,
  }
}

/** GET /api/cart - корзина текущего пользователя. */
router.get('/', async (req, res) => {
  res.json(await loadCart(req.user.id))
})

/**
 * POST /api/cart - добавить услугу. Тело: { serviceId, quantity = 1 }.
 * Если услуга уже в корзине - количество увеличивается (но не больше 10).
 */
router.post('/', async (req, res) => {
  const d = validate(req.body, {
    serviceId: { type: 'int', required: true, min: 1 },
    quantity: { type: 'int', min: 1, max: MAX_QUANTITY, default: 1 },
  })
  const service = await query('SELECT is_active FROM services WHERE id = $1', [d.serviceId])
  if (service.rowCount === 0 || !service.rows[0].is_active) throw notFound('Услуга не найдена или недоступна')

  const current = await query('SELECT quantity FROM cart_items WHERE user_id = $1 AND service_id = $2', [
    req.user.id,
    d.serviceId,
  ])
  if ((current.rows[0]?.quantity ?? 0) + d.quantity > MAX_QUANTITY) {
    throw badRequest(`Можно заказать не больше ${MAX_QUANTITY} шт. одной услуги`)
  }

  await query(
    `INSERT INTO cart_items (user_id, service_id, quantity) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, service_id) DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
    [req.user.id, d.serviceId, d.quantity],
  )
  res.status(201).json(await loadCart(req.user.id))
})

/** PATCH /api/cart/:itemId - изменить количество. Тело: { quantity }. */
router.patch('/:itemId', async (req, res) => {
  const itemId = parseId(req.params.itemId)
  const d = validate(req.body, { quantity: { type: 'int', required: true, min: 1, max: MAX_QUANTITY } })
  // user_id в условии - чужую позицию изменить нельзя
  const { rowCount } = await query('UPDATE cart_items SET quantity = $1 WHERE id = $2 AND user_id = $3', [
    d.quantity,
    itemId,
    req.user.id,
  ])
  if (rowCount === 0) throw notFound('Позиция в корзине не найдена')
  res.json(await loadCart(req.user.id))
})

/** DELETE /api/cart/:itemId - удалить позицию. */
router.delete('/:itemId', async (req, res) => {
  const itemId = parseId(req.params.itemId)
  const { rowCount } = await query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2', [itemId, req.user.id])
  if (rowCount === 0) throw notFound('Позиция в корзине не найдена')
  res.json(await loadCart(req.user.id))
})

/** DELETE /api/cart - очистить корзину. */
router.delete('/', async (req, res) => {
  await query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id])
  res.json(await loadCart(req.user.id))
})

export default router
