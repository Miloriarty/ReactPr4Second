/* Форматирование значений для отображения. */

const priceFormat = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** 4500 → "4 500 ₽" */
export const formatPrice = (value) => priceFormat.format(value)

/** 90 → "1 ч 30 мин" */
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h && `${h} ч`, m && `${m} мин`].filter(Boolean).join(' ') || '0 мин'
}

/** '2026-10-29' → "29 октября 2026 г." (без сдвига часового пояса) */
export function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return dateFormat.format(new Date(y, m - 1, d))
}

/** ISO-время → "29 окт. 2026 г., 18:00" */
export const formatDateTime = (iso) => dateTimeFormat.format(new Date(iso))

/** Сегодняшняя дата 'YYYY-MM-DD' по локальному времени. */
export function todayString(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Склонение: plural(3, ['отзыв', 'отзыва', 'отзывов']) → "отзыва" */
export function plural(n, [one, few, many]) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

/**
 * Маска ввода телефона: по мере набора превращает цифры в "+7 (900) 123-45-67".
 * Первая 8 или 7 считается кодом страны; лишние цифры после десятой отбрасываются.
 * Разделители в конце не дописываются - иначе Backspace "застревал" бы на них.
 */
export function formatPhoneInput(raw) {
  const value = String(raw).trim()
  // ручной набор "+" и "+7"; Backspace с "+7 (" дает "+7 " и очищает поле
  if (raw === '+') return '+'
  if (raw === '+7') return '+7 ('
  // иностранный номер не переделываем под +7 - пусть валидатор покажет понятную ошибку
  if (value.startsWith('+') && !value.startsWith('+7')) return value.slice(0, 20)
  let digits = value.replace(/\D/g, '')
  if (value.startsWith('+7') || /^[78]/.test(value)) {
    digits = digits.slice(1)
    // набрали только "8" или "7" - показываем начало маски, чтобы было понятно, что нажатие сработало
    if (!digits && !value.startsWith('+')) return '+7 ('
  }
  digits = digits.slice(0, 10)
  if (!digits) return ''

  let result = `+7 (${digits.slice(0, 3)}`
  if (digits.length > 3) result += `) ${digits.slice(3, 6)}`
  if (digits.length > 6) result += `-${digits.slice(6, 8)}`
  if (digits.length > 8) result += `-${digits.slice(8, 10)}`
  return result
}
