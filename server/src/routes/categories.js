import { Router } from 'express'
import { query } from '../db.js'
import { adminOnly, authRequired } from '../middleware/auth.js'
import { conflict, notFound } from '../utils/HttpError.js'
import { slugify } from '../utils/slug.js'
import { parseId, validate } from '../utils/validation.js'

const router = Router()

const categorySchema = {
  name: { type: 'string', required: true, min: 2, max: 100 },
  description: { type: 'string', max: 500 },
}

/** GET /api/categories - категории с количеством активных услуг в каждой. */
router.get('/', async (req, res) => {
  const { rows } = await query(`
    SELECT c.id, c.slug, c.name, c.description,
           COUNT(s.id) FILTER (WHERE s.is_active)::int AS "servicesCount"
    FROM categories c
    LEFT JOIN services s ON s.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name`)
  res.json(rows)
})

/** Проверяет уникальность названия категории (кроме самой редактируемой). */
async function ensureUniqueName(name, exceptId = 0) {
  const { rowCount } = await query('SELECT 1 FROM categories WHERE lower(name) = lower($1) AND id <> $2', [name, exceptId])
  if (rowCount > 0) throw conflict('Категория с таким названием уже есть', { name: 'Название занято' })
}

/** Подбирает свободный slug: dlya-ofisa, dlya-ofisa-2, ... */
async function uniqueSlug(name, exceptId = 0) {
  const base = slugify(name)
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    const { rowCount } = await query('SELECT 1 FROM categories WHERE slug = $1 AND id <> $2', [slug, exceptId])
    if (rowCount === 0) return slug
  }
}

/** POST /api/categories - создать категорию (админ). */
router.post('/', authRequired, adminOnly, async (req, res) => {
  const data = validate(req.body, categorySchema)
  await ensureUniqueName(data.name)
  const { rows } = await query(
    'INSERT INTO categories (slug, name, description) VALUES ($1, $2, $3) RETURNING id, slug, name, description',
    [await uniqueSlug(data.name), data.name, data.description],
  )
  res.status(201).json(rows[0])
})

/** PUT /api/categories/:id - изменить категорию (админ). */
router.put('/:id', authRequired, adminOnly, async (req, res) => {
  const id = parseId(req.params.id)
  const data = validate(req.body, categorySchema)
  await ensureUniqueName(data.name, id)
  const { rows } = await query(
    `UPDATE categories SET slug = $1, name = $2, description = $3 WHERE id = $4
     RETURNING id, slug, name, description`,
    [await uniqueSlug(data.name, id), data.name, data.description, id],
  )
  if (rows.length === 0) throw notFound('Категория не найдена')
  res.json(rows[0])
})

/** DELETE /api/categories/:id - удалить категорию (админ), только если в ней нет услуг. */
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  const id = parseId(req.params.id)
  const used = await query('SELECT COUNT(*)::int AS n FROM services WHERE category_id = $1', [id])
  if (used.rows[0].n > 0) {
    throw conflict(`В категории есть услуги (${used.rows[0].n}). Сначала перенесите или удалите их`)
  }
  const { rowCount } = await query('DELETE FROM categories WHERE id = $1', [id])
  if (rowCount === 0) throw notFound('Категория не найдена')
  res.status(204).end()
})

export default router
