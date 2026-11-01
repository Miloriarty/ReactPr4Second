import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { query } from '../db.js'
import { forbidden, unauthorized } from '../utils/HttpError.js'

/** Выдает JWT для пользователя. */
export function signToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })
}

/** Публичное представление пользователя (без хеша пароля). */
export function publicUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    defaultAddress: row.default_address,
    role: row.role_code,
    roleName: row.role_name,
    createdAt: row.created_at,
  }
}

/** SELECT пользователя вместе с ролью (JOIN roles). */
export const USER_SELECT = `
  SELECT u.id, u.full_name, u.email, u.phone, u.default_address, u.password_hash,
         u.password_changed_at, u.created_at, r.code AS role_code, r.name AS role_name
  FROM users u
  JOIN roles r ON r.id = u.role_id`

/**
 * Достает пользователя по токену из заголовка Authorization: Bearer <token>.
 * Возвращает null, если токена нет; бросает 401, если токен недействителен.
 * Токен, выданный до смены пароля, считается недействительным - так смена
 * пароля "выкидывает" все остальные сессии.
 */
async function resolveUser(req) {
  const header = req.get('Authorization') || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) return null

  let payload
  try {
    payload = jwt.verify(token, config.jwtSecret)
  } catch {
    throw unauthorized('Сессия истекла, войдите снова')
  }

  const { rows } = await query(`${USER_SELECT} WHERE u.id = $1`, [payload.sub])
  const user = rows[0]
  if (!user) throw unauthorized('Пользователь не найден, войдите снова')
  // iat в секундах; допускаем погрешность в 1 секунду
  if (payload.iat * 1000 < user.password_changed_at.getTime() - 1000) {
    throw unauthorized('Пароль был изменён, войдите снова')
  }
  return user
}

/** Пропускает только авторизованных; кладет пользователя в req.user. */
export async function authRequired(req, res, next) {
  const user = await resolveUser(req)
  if (!user) throw unauthorized()
  req.user = user
  next()
}

/** Авторизация не обязательна, но если токен есть - req.user будет заполнен. */
export async function authOptional(req, res, next) {
  try {
    req.user = await resolveUser(req)
  } catch {
    req.user = null
  }
  next()
}

/** Пропускает только администраторов. Ставится после authRequired. */
export function adminOnly(req, res, next) {
  if (req.user?.role_code !== 'admin') throw forbidden('Доступно только администратору')
  next()
}
