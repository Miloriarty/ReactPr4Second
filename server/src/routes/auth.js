import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { query, withTransaction } from '../db.js'
import { mailEnabled, sendPasswordResetCode } from '../mail.js'
import { authRequired, publicUser, signToken, USER_SELECT } from '../middleware/auth.js'
import { badRequest, conflict, HttpError, unauthorized } from '../utils/HttpError.js'
import { validate } from '../utils/validation.js'

const router = Router()

const RESET_CODE_TTL_MIN = 15
const RESET_MAX_ATTEMPTS = 5
const RESET_RESEND_COOLDOWN_SEC = 60

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')

/**
 * POST /api/auth/register - регистрация.
 * Тело: { fullName, email, password, phone }. Возвращает { token, user }.
 */
router.post('/register', async (req, res) => {
  const data = validate(req.body, {
    fullName: { type: 'name', required: true },
    email: { type: 'email', required: true },
    password: { type: 'password', required: true },
    phone: { type: 'phone', required: true },
  })

  const exists = await query('SELECT 1 FROM users WHERE email = $1', [data.email])
  if (exists.rowCount > 0) {
    throw conflict('Пользователь с таким email уже зарегистрирован', {
      email: 'Этот email уже занят. Войдите или восстановите пароль',
    })
  }

  const passwordHash = await bcrypt.hash(data.password, 10)
  const { rows } = await query(
    `INSERT INTO users (role_id, full_name, email, phone, password_hash)
     SELECT r.id, $1, $2, $3, $4 FROM roles r WHERE r.code = 'user'
     RETURNING id`,
    [data.fullName, data.email, data.phone, passwordHash],
  )
  const user = (await query(`${USER_SELECT} WHERE u.id = $1`, [rows[0].id])).rows[0]
  res.status(201).json({ token: signToken(user), user: publicUser(user) })
})

/**
 * POST /api/auth/login - вход по email и паролю.
 * На неверную пару отвечает одинаковой ошибкой, чтобы не раскрывать, есть ли такой email.
 */
router.post('/login', async (req, res) => {
  const data = validate(req.body, {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, min: 1, max: 72 },
  })

  const { rows } = await query(`${USER_SELECT} WHERE u.email = $1`, [data.email])
  const user = rows[0]
  // bcrypt.compare(password, ...) по сырому паролю: validate обрезает пробелы, а пароль - нет
  const ok = user && (await bcrypt.compare(String(req.body.password), user.password_hash))
  if (!ok) throw unauthorized('Неверный email или пароль')

  res.json({ token: signToken(user), user: publicUser(user) })
})

/** GET /api/auth/me - текущий пользователь по токену (проверка сессии при загрузке фронтенда). */
router.get('/me', authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

/**
 * POST /api/auth/forgot-password - запрос кода восстановления.
 * Создает одноразовый 6-значный код на 15 минут и отправляет его письмом на email.
 * Ответ одинаковый для существующих и несуществующих адресов, чтобы не раскрывать,
 * кто зарегистрирован. Повторный запрос чаще раза в минуту молча игнорируется
 * (фронтенд показывает таймер до повторной отправки - resendIn, сек).
 */
router.post('/forgot-password', async (req, res) => {
  const { email } = validate(req.body, { email: { type: 'email', required: true } })
  const response = {
    message: 'Если такой email зарегистрирован, на него отправлено письмо с кодом',
    resendIn: RESET_RESEND_COOLDOWN_SEC,
  }

  const { rows } = await query(
    `SELECT u.id, u.full_name,
            (SELECT max(pr.created_at) > now() - make_interval(secs => $2)
             FROM password_resets pr WHERE pr.user_id = u.id) AS too_soon
     FROM users u WHERE u.email = $1`,
    [email, RESET_RESEND_COOLDOWN_SEC],
  )
  const user = rows[0]
  if (!user || user.too_soon) return res.json(response)

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  await withTransaction(async (client) => {
    // старые неиспользованные коды больше не действуют
    await client.query(
      'UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
      [user.id],
    )
    await client.query(
      `INSERT INTO password_resets (user_id, code_hash, expires_at)
       VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [user.id, sha256(code), RESET_CODE_TTL_MIN],
    )
    // письмо отправляем внутри транзакции: если SMTP отказал, новый код не сохранится,
    // а старый останется действующим
    try {
      await sendPasswordResetCode({ to: email, name: user.full_name, code, ttlMinutes: RESET_CODE_TTL_MIN })
    } catch (err) {
      console.error(`[password reset] не удалось отправить письмо на ${email}: ${err.message}`)
      throw new HttpError(503, 'Не удалось отправить письмо. Попробуйте ещё раз через несколько минут')
    }
  })

  // без SMTP в режиме разработки код можно взять из консоли сервера
  if (!mailEnabled) console.log(`[password reset] ${email}: код ${code} (действует ${RESET_CODE_TTL_MIN} мин)`)
  res.json(response)
})

/**
 * POST /api/auth/reset-password - установка нового пароля по коду.
 * Тело: { email, code, newPassword }. После 5 неверных попыток код сгорает.
 * При успехе сразу авторизует пользователя: { token, user }.
 */
router.post('/reset-password', async (req, res) => {
  const data = validate(req.body, {
    email: { type: 'email', required: true },
    code: { type: 'string', required: true, pattern: /^\d{6}$/, patternMessage: 'Код состоит из 6 цифр' },
    newPassword: { type: 'password', required: true },
  })
  const invalid = () => badRequest('Код неверный или устарел. Запросите новый код', { code: 'Неверный или устаревший код' })

  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT pr.id, pr.code_hash, pr.attempts, u.id AS user_id
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE u.email = $1 AND pr.used_at IS NULL AND pr.expires_at > now()
       ORDER BY pr.created_at DESC
       LIMIT 1
       FOR UPDATE OF pr`,
      [data.email],
    )
    const reset = rows[0]
    if (!reset || reset.attempts >= RESET_MAX_ATTEMPTS) return { error: invalid() }

    if (reset.code_hash !== sha256(data.code)) {
      await client.query('UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1', [reset.id])
      return { error: invalid() }
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10)
    await client.query(
      'UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2',
      [passwordHash, reset.user_id],
    )
    await client.query('UPDATE password_resets SET used_at = now() WHERE id = $1', [reset.id])
    return { userId: reset.user_id }
  })
  // ошибку бросаем после COMMIT, чтобы увеличенный счетчик попыток сохранился
  if (result.error) throw result.error

  const user = (await query(`${USER_SELECT} WHERE u.id = $1`, [result.userId])).rows[0]
  res.json({ token: signToken(user), user: publicUser(user) })
})

export default router
