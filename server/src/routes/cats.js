import { Router } from 'express'
import { query } from '../db.js'
import { adminOnly, authOptional, authRequired } from '../middleware/auth.js'
import { notFound } from '../utils/HttpError.js'
import { parseId, validate } from '../utils/validation.js'

const router = Router()

const catSchema = {
  name: { type: 'name', required: true, max: 50 },
  breed: { type: 'string', min: 2, max: 100 },
  ageYears: { type: 'int', min: 0, max: 30 },
  photoUrl: { type: 'url' },
  description: { type: 'string', max: 1000 },
  isActive: { type: 'bool', default: true },
}

/** SELECT кота вместе со списком услуг, на которых он работает (JOIN service_cats + services). */
const CAT_SELECT = `
  SELECT c.id, c.name, c.breed, c.age_years AS "ageYears", c.photo_url AS "photoUrl",
         c.description, c.is_active AS "isActive",
         COALESCE(json_agg(json_build_object('id', s.id, 'title', s.title) ORDER BY s.title)
                  FILTER (WHERE s.id IS NOT NULL), '[]') AS services
  FROM cats c
  LEFT JOIN service_cats sc ON sc.cat_id = c.id
  LEFT JOIN services s ON s.id = sc.service_id`

/**
 * GET /api/cats - команда котиков. Гости и пользователи видят только активных,
 * администратор с ?all=1 - всех (для админки).
 */
router.get('/', authOptional, async (req, res) => {
  const showAll = req.user?.role_code === 'admin' && req.query.all === '1'
  const { rows } = await query(
    `${CAT_SELECT} ${showAll ? '' : 'WHERE c.is_active'} GROUP BY c.id ORDER BY c.name`,
  )
  res.json(rows)
})

/** GET /api/cats/:id - карточка кота. */
router.get('/:id', authOptional, async (req, res) => {
  const id = parseId(req.params.id)
  const { rows } = await query(`${CAT_SELECT} WHERE c.id = $1 GROUP BY c.id`, [id])
  const cat = rows[0]
  if (!cat || (!cat.isActive && req.user?.role_code !== 'admin')) throw notFound('Котик не найден')
  res.json(cat)
})

/** POST /api/cats - добавить кота (админ). */
router.post('/', authRequired, adminOnly, async (req, res) => {
  const d = validate(req.body, catSchema)
  const { rows } = await query(
    `INSERT INTO cats (name, breed, age_years, photo_url, description, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [d.name, d.breed, d.ageYears, d.photoUrl, d.description, d.isActive],
  )
  const created = await query(`${CAT_SELECT} WHERE c.id = $1 GROUP BY c.id`, [rows[0].id])
  res.status(201).json(created.rows[0])
})

/** PUT /api/cats/:id - изменить кота (админ). */
router.put('/:id', authRequired, adminOnly, async (req, res) => {
  const id = parseId(req.params.id)
  const d = validate(req.body, catSchema)
  const { rowCount } = await query(
    `UPDATE cats SET name = $1, breed = $2, age_years = $3, photo_url = $4, description = $5, is_active = $6
     WHERE id = $7`,
    [d.name, d.breed, d.ageYears, d.photoUrl, d.description, d.isActive, id],
  )
  if (rowCount === 0) throw notFound('Котик не найден')
  const updated = await query(`${CAT_SELECT} WHERE c.id = $1 GROUP BY c.id`, [id])
  res.json(updated.rows[0])
})

/** DELETE /api/cats/:id - удалить кота (админ); связи с услугами удаляются каскадно. */
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  const id = parseId(req.params.id)
  const { rowCount } = await query('DELETE FROM cats WHERE id = $1', [id])
  if (rowCount === 0) throw notFound('Котик не найден')
  res.status(204).end()
})

export default router
