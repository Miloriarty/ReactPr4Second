import { Router } from 'express'
import { query, withTransaction } from '../db.js'
import { adminOnly, authOptional, authRequired } from '../middleware/auth.js'
import { badRequest, conflict, notFound } from '../utils/HttpError.js'
import { parseId, validate } from '../utils/validation.js'

const router = Router()

/**
 * SELECT услуги со всеми связанными данными одним запросом:
 * категория (JOIN categories), рейтинг и число отзывов (JOIN reviews),
 * котики-исполнители (JOIN service_cats + cats).
 */
const SERVICE_SELECT = `
  SELECT s.id, s.title, s.description, s.duration_minutes AS "durationMinutes", s.price,
         s.image_url AS "imageUrl", s.is_active AS "isActive",
         json_build_object('id', c.id, 'slug', c.slug, 'name', c.name) AS category,
         COALESCE(r.avg, 0) AS rating,
         COALESCE(r.cnt, 0) AS "reviewsCount",
         COALESCE(k.cats, '[]') AS cats
  FROM services s
  JOIN categories c ON c.id = s.category_id
  LEFT JOIN LATERAL (
    SELECT ROUND(AVG(rv.rating), 1) AS avg, COUNT(*)::int AS cnt
    FROM reviews rv WHERE rv.service_id = s.id
  ) r ON TRUE
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('id', ct.id, 'name', ct.name, 'photoUrl', ct.photo_url) ORDER BY ct.name) AS cats
    FROM service_cats sc
    JOIN cats ct ON ct.id = sc.cat_id
    WHERE sc.service_id = s.id AND ct.is_active
  ) k ON TRUE`

const SORTS = {
  title: 's.title ASC',
  price_asc: 's.price ASC, s.title',
  price_desc: 's.price DESC, s.title',
  duration: 's.duration_minutes ASC, s.title',
  rating: 'rating DESC, s.title',
}

const isAdmin = (req) => req.user?.role_code === 'admin'

/**
 * GET /api/services - каталог с фильтрами:
 *   ?category=<slug> &minPrice= &maxPrice= &search= &sort=title|price_asc|price_desc|duration|rating
 *   ?all=1 - для админа показывает и скрытые услуги.
 */
router.get('/', authOptional, async (req, res) => {
  const f = validate(req.query, {
    category: { type: 'string', max: 60 },
    search: { type: 'string', max: 100 },
    minPrice: { type: 'number', min: 0, max: 10_000_000 },
    maxPrice: { type: 'number', min: 0, max: 10_000_000 },
    sort: { type: 'string', max: 20, default: 'title' },
  })
  if (!SORTS[f.sort]) throw badRequest('Неизвестная сортировка', { sort: `Допустимо: ${Object.keys(SORTS).join(', ')}` })
  if (f.minPrice !== null && f.maxPrice !== null && f.minPrice > f.maxPrice) {
    throw badRequest('Минимальная цена больше максимальной', { minPrice: 'Не больше максимальной цены' })
  }

  const where = []
  const params = []
  const add = (sql, value) => {
    params.push(value)
    where.push(sql.replace('?', `$${params.length}`))
  }
  if (!(isAdmin(req) && req.query.all === '1')) where.push('s.is_active')
  if (f.category) add('c.slug = ?', f.category)
  if (f.search) add("(s.title ILIKE '%' || ? || '%')", f.search.replace(/[\\%_]/g, '\\$&'))
  if (f.minPrice !== null) add('s.price >= ?', f.minPrice)
  if (f.maxPrice !== null) add('s.price <= ?', f.maxPrice)

  const { rows } = await query(
    `${SERVICE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${SORTS[f.sort]}`,
    params,
  )
  res.json(rows)
})

/** GET /api/services/:id - карточка услуги. */
router.get('/:id', authOptional, async (req, res) => {
  const id = parseId(req.params.id)
  const { rows } = await query(`${SERVICE_SELECT} WHERE s.id = $1`, [id])
  const service = rows[0]
  if (!service || (!service.isActive && !isAdmin(req))) throw notFound('Услуга не найдена')
  res.json(service)
})

const serviceSchema = {
  categoryId: { type: 'int', required: true, min: 1, requiredMessage: 'Выберите категорию' },
  title: { type: 'string', required: true, min: 3, max: 150 },
  description: { type: 'string', required: true, min: 10, max: 2000 },
  durationMinutes: { type: 'int', required: true, min: 15, max: 1440 },
  price: { type: 'number', required: true, min: 0, max: 10_000_000 },
  imageUrl: { type: 'url' },
  isActive: { type: 'bool', default: true },
  catIds: { type: 'intArray', default: [] },
}

/** Проверяет ссылки услуги: существует ли категория, все ли коты, не занято ли название. */
async function checkServiceRefs(client, data, exceptId = 0) {
  const cat = await client.query('SELECT 1 FROM categories WHERE id = $1', [data.categoryId])
  if (cat.rowCount === 0) throw badRequest('Категория не найдена', { categoryId: 'Выберите существующую категорию' })

  if (data.catIds.length > 0) {
    const found = await client.query('SELECT COUNT(*)::int AS n FROM cats WHERE id = ANY($1::int[])', [data.catIds])
    if (found.rows[0].n !== data.catIds.length) throw badRequest('Некоторые котики не найдены', { catIds: 'Обновите список котиков' })
  }

  const dup = await client.query('SELECT 1 FROM services WHERE lower(title) = lower($1) AND id <> $2', [data.title, exceptId])
  if (dup.rowCount > 0) throw conflict('Услуга с таким названием уже есть', { title: 'Название занято' })
}

/** Перезаписывает список котиков, закрепленных за услугой. */
async function saveServiceCats(client, serviceId, catIds) {
  await client.query('DELETE FROM service_cats WHERE service_id = $1', [serviceId])
  if (catIds.length > 0) {
    await client.query(
      'INSERT INTO service_cats (service_id, cat_id) SELECT $1, unnest($2::int[])',
      [serviceId, catIds],
    )
  }
}

/** POST /api/services - создать услугу (админ). */
router.post('/', authRequired, adminOnly, async (req, res) => {
  const d = validate(req.body, serviceSchema)
  const id = await withTransaction(async (client) => {
    await checkServiceRefs(client, d)
    const { rows } = await client.query(
      `INSERT INTO services (category_id, title, description, duration_minutes, price, image_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [d.categoryId, d.title, d.description, d.durationMinutes, d.price, d.imageUrl, d.isActive],
    )
    await saveServiceCats(client, rows[0].id, d.catIds)
    return rows[0].id
  })
  const { rows } = await query(`${SERVICE_SELECT} WHERE s.id = $1`, [id])
  res.status(201).json(rows[0])
})

/** PUT /api/services/:id - изменить услугу (админ). */
router.put('/:id', authRequired, adminOnly, async (req, res) => {
  const id = parseId(req.params.id)
  const d = validate(req.body, serviceSchema)
  await withTransaction(async (client) => {
    await checkServiceRefs(client, d, id)
    const { rowCount } = await client.query(
      `UPDATE services SET category_id = $1, title = $2, description = $3, duration_minutes = $4,
              price = $5, image_url = $6, is_active = $7
       WHERE id = $8`,
      [d.categoryId, d.title, d.description, d.durationMinutes, d.price, d.imageUrl, d.isActive, id],
    )
    if (rowCount === 0) throw notFound('Услуга не найдена')
    await saveServiceCats(client, id, d.catIds)
  })
  const { rows } = await query(`${SERVICE_SELECT} WHERE s.id = $1`, [id])
  res.json(rows[0])
})

/**
 * DELETE /api/services/:id - удалить услугу (админ).
 * Из корзин она исчезает, а в старых заказах остается снимок названия и цены.
 */
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  const id = parseId(req.params.id)
  const { rowCount } = await query('DELETE FROM services WHERE id = $1', [id])
  if (rowCount === 0) throw notFound('Услуга не найдена')
  res.status(204).end()
})

export default router
