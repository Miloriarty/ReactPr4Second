import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { query } from '../db.js'
import { authRequired, publicUser, signToken, USER_SELECT } from '../middleware/auth.js'
import { badRequest, conflict } from '../utils/HttpError.js'
import { validate } from '../utils/validation.js'

const router = Router()
router.use(authRequired)

/** GET /api/profile - личные данные текущего пользователя. */
router.get('/', (req, res) => {
  res.json({ user: publicUser(req.user) })
})

/**
 * PUT /api/profile - редактирование личных данных.
 * Тело: { fullName, email, phone, defaultAddress? }.
 */
router.put('/', async (req, res) => {
  const data = validate(req.body, {
    fullName: { type: 'name', required: true },
    email: { type: 'email', required: true },
    phone: { type: 'phone', required: true },
    defaultAddress: { type: 'address' },
  })

  const taken = await query('SELECT 1 FROM users WHERE email = $1 AND id <> $2', [data.email, req.user.id])
  if (taken.rowCount > 0) {
    throw conflict('Этот email уже используется другим пользователем', { email: 'Email уже занят' })
  }

  await query(
    `UPDATE users SET full_name = $1, email = $2, phone = $3, default_address = $4 WHERE id = $5`,
    [data.fullName, data.email, data.phone, data.defaultAddress, req.user.id],
  )
  const user = (await query(`${USER_SELECT} WHERE u.id = $1`, [req.user.id])).rows[0]
  res.json({ user: publicUser(user) })
})

/**
 * PUT /api/profile/password - смена пароля.
 * Тело: { currentPassword, newPassword }. Возвращает новый токен:
 * старые токены (другие устройства) после смены пароля перестают действовать.
 */
router.put('/password', async (req, res) => {
  const data = validate(req.body, {
    currentPassword: { type: 'string', required: true, max: 72 },
    newPassword: { type: 'password', required: true },
  })

  const ok = await bcrypt.compare(String(req.body.currentPassword), req.user.password_hash)
  if (!ok) throw badRequest('Текущий пароль указан неверно', { currentPassword: 'Неверный пароль' })
  if (data.newPassword === req.body.currentPassword) {
    throw badRequest('Новый пароль совпадает с текущим', { newPassword: 'Придумайте новый пароль' })
  }

  const passwordHash = await bcrypt.hash(data.newPassword, 10)
  await query('UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2', [
    passwordHash,
    req.user.id,
  ])
  res.json({ message: 'Пароль изменён', token: signToken(req.user) })
})

export default router
