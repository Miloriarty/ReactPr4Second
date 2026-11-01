import { Router } from 'express'
import { query } from '../db.js'
import { adminOnly, authOptional, authRequired } from '../middleware/auth.js'
import { conflict, forbidden, notFound } from '../utils/HttpError.js'
import { parseId, validate } from '../utils/validation.js'

const router = Router()

const reviewSchema = {
  rating: { type: 'int', required: true, min: 1, max: 5, requiredMessage: 'Поставьте оценку' },
  comment: { type: 'string', required: true, min: 3, max: 1000 },
}

/** SELECT отзыва с именем автора (JOIN users) и названием услуги (JOIN services). */
const REVIEW_SELECT = `
  SELECT rv.id, rv.rating, rv.comment, rv.created_at AS "createdAt", rv.updated_at AS "updatedAt",
         u.full_name AS "authorName", rv.user_id = $1 AS "isMine",
         json_build_object('id', s.id, 'title', s.title) AS service
  FROM reviews rv
  JOIN users u ON u.id = rv.user_id
  JOIN services s ON s.id = rv.service_id`

/** GET /api/services/:serviceId/reviews - все отзывы по услуге (доступно всем). */
router.get('/services/:serviceId/reviews', authOptional, async (req, res) => {
  const serviceId = parseId(req.params.serviceId)
  const exists = await query('SELECT 1 FROM services WHERE id = $1', [serviceId])
  if (exists.rowCount === 0) throw notFound('Услуга не найдена')

  const { rows } = await query(
    `${REVIEW_SELECT} WHERE rv.service_id = $2 ORDER BY rv.created_at DESC`,
    [req.user?.id ?? 0, serviceId],
  )
  res.json(rows)
})

/**
 * POST /api/services/:serviceId/reviews - оставить отзыв (только авторизованные).
 * Один пользователь - один отзыв на услугу; повторно его можно отредактировать.
 */
router.post('/services/:serviceId/reviews', authRequired, async (req, res) => {
  const serviceId = parseId(req.params.serviceId)
  const d = validate(req.body, reviewSchema)

  const service = await query('SELECT is_active FROM services WHERE id = $1', [serviceId])
  if (service.rowCount === 0 || !service.rows[0].is_active) throw notFound('Услуга не найдена')
  const mine = await query('SELECT 1 FROM reviews WHERE user_id = $1 AND service_id = $2', [req.user.id, serviceId])
  if (mine.rowCount > 0) throw conflict('Вы уже оставили отзыв на эту услугу — его можно отредактировать')

  const { rows } = await query(
    'INSERT INTO reviews (user_id, service_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING id',
    [req.user.id, serviceId, d.rating, d.comment],
  )
  const created = await query(`${REVIEW_SELECT} WHERE rv.id = $2`, [req.user.id, rows[0].id])
  res.status(201).json(created.rows[0])
})

/** GET /api/reviews - все отзывы для модерации (админ). */
router.get('/reviews', authRequired, adminOnly, async (req, res) => {
  const { rows } = await query(`${REVIEW_SELECT} ORDER BY rv.created_at DESC`, [req.user.id])
  res.json(rows)
})

/** PUT /api/reviews/:id - изменить свой отзыв. */
router.put('/reviews/:id', authRequired, async (req, res) => {
  const id = parseId(req.params.id)
  const d = validate(req.body, reviewSchema)
  const found = await query('SELECT user_id FROM reviews WHERE id = $1', [id])
  if (found.rowCount === 0) throw notFound('Отзыв не найден')
  if (found.rows[0].user_id !== req.user.id) throw forbidden('Можно редактировать только свои отзывы')

  await query('UPDATE reviews SET rating = $1, comment = $2, updated_at = now() WHERE id = $3', [d.rating, d.comment, id])
  const updated = await query(`${REVIEW_SELECT} WHERE rv.id = $2`, [req.user.id, id])
  res.json(updated.rows[0])
})

/** DELETE /api/reviews/:id - удалить отзыв: свой или любой (админ). */
router.delete('/reviews/:id', authRequired, async (req, res) => {
  const id = parseId(req.params.id)
  const found = await query('SELECT user_id FROM reviews WHERE id = $1', [id])
  if (found.rowCount === 0) throw notFound('Отзыв не найден')
  if (found.rows[0].user_id !== req.user.id && req.user.role_code !== 'admin') {
    throw forbidden('Можно удалять только свои отзывы')
  }
  await query('DELETE FROM reviews WHERE id = $1', [id])
  res.status(204).end()
})

export default router
