import 'dotenv/config'

/**
 * Настройки сервера из переменных окружения (.env).
 * Без JWT_SECRET и DATABASE_URL сервер не стартует
 */
function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Не задана переменная окружения ${name} (см. server/.env.example)`)
  return value
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  isDev: process.env.NODE_ENV !== 'production',
  // SMTP для писем (восстановление пароля). Без SMTP_HOST письма не отправляются
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 465,
    // 465 - сразу TLS, 587 - STARTTLS (secure=false)
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : Number(process.env.SMTP_PORT || 465) === 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  mailFrom: process.env.MAIL_FROM || process.env.SMTP_USER || '',
}
