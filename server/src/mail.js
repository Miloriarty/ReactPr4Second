import nodemailer from 'nodemailer'
import { config } from './config.js'

/**
 * Отправка писем через SMTP (nodemailer).
 * Настройки - SMTP_* и MAIL_FROM в server/.env. Если SMTP_HOST не задан,
 * в режиме разработки письмо не отправляется, а выводится в консоль сервера;
 * в production это ошибка конфигурации.
 */
export const mailEnabled = Boolean(config.smtp.host)

const transporter = mailEnabled
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null

/** Проверка подключения к SMTP при старте сервера - только пишет результат в лог. */
export async function verifyMail() {
  if (!transporter) {
    console.warn('[mail] SMTP_HOST не задан — письма не отправляются, коды выводятся в консоль')
    return
  }
  try {
    await transporter.verify()
    console.log(`[mail] SMTP подключён: ${config.smtp.host}:${config.smtp.port}`)
  } catch (err) {
    console.error(`[mail] Не удалось подключиться к SMTP ${config.smtp.host}: ${err.message}`)
  }
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * Письмо с кодом восстановления пароля.
 * @param {{ to: string, name: string, code: string, ttlMinutes: number }} params
 * @throws если SMTP-сервер отказал в отправке
 */
export async function sendPasswordResetCode({ to, name, code, ttlMinutes }) {
  const subject = `Код восстановления пароля: ${code}`
  const text = [
    `Здравствуйте, ${name}!`,
    '',
    'Вы запросили восстановление пароля на сайте "Котики-терапевты на выезд".',
    `Ваш код: ${code}`,
    `Код действует ${ttlMinutes} минут. Никому его не сообщайте.`,
    '',
    'Если вы не запрашивали восстановление, просто проигнорируйте это письмо — пароль останется прежним.',
  ].join('\n')

  const html = `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#222">
  <h2 style="margin:0 0 16px">Восстановление пароля</h2>
  <p>Здравствуйте, ${escapeHtml(name)}!</p>
  <p>Вы запросили восстановление пароля на сайте "Котики-терапевты на выезд". Введите этот код на странице восстановления:</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f3f0ea;padding:16px;text-align:center;border-radius:8px">${code}</p>
  <p>Код действует <b>${ttlMinutes} минут</b>. Никому его не сообщайте.</p>
  <p style="color:#777;font-size:13px">Если вы не запрашивали восстановление, просто проигнорируйте это письмо — пароль останется прежним.</p>
</div>`

  if (!transporter) {
    if (!config.isDev) throw new Error('SMTP не настроен (SMTP_HOST)')
    console.log(`[mail:dev] письмо для ${to} не отправлено (нет SMTP). ${subject}`)
    return
  }
  await transporter.sendMail({ from: config.mailFrom, to, subject, text, html })
}
