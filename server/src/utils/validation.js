import { badRequest } from './HttpError.js'

/*
 * Небольшой валидатор входных данных. Схема описывает поля:
 *   { email: { type: 'email', required: true }, age: { type: 'int', min: 0, max: 30 } }
 * validate() возвращает очищенные и приведенные к нужному типу значения
 * или бросает ошибку 400 со списком ошибок по каждому полю.
 *
 * Сервер никогда не доверяет фронтенду: та же валидация, что и в формах,
 * повторяется здесь, поэтому API выдерживает любые "кривые" данные.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const NAME_RE = /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё\s'.-]*$/
const PHONE_CHARS_RE = /^[\d\s()+-]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const URL_RE = /^(https?:\/\/[^\s]+|\/[^\s]*)$/
const ADDRESS_CHARS_RE = /^[A-Za-zА-Яа-яЁё0-9\s.,\-/№()«»"']+$/

/**
 * Проверяет адрес по формату (существование адреса не проверяется) и схлопывает пробелы.
 * Нужны: допустимые символы, слово из 3+ букв (город/улица), цифра (номер дома),
 * без длинных повторов одного символа ("ааааа", "11111"). Длина 5-255.
 */
export function normalizeAddress(raw) {
  const value = String(raw).trim().replace(/\s+/g, ' ')
  if (value.length < 5) return { error: 'Адрес слишком короткий' }
  if (value.length > 255) return { error: 'Максимум символов: 255' }
  if (!ADDRESS_CHARS_RE.test(value)) {
    return { error: 'Адрес может содержать только буквы, цифры, пробелы и знаки . , - / № ( ) « » " \'' }
  }
  if (/(.)\1{4,}/.test(value)) return { error: 'Адрес похож на случайный набор символов' }
  if (!/[A-Za-zА-Яа-яЁё]{3,}/.test(value)) {
    return { error: 'Укажите город и улицу словами, например: г. Москва, ул. Тверская, д. 1' }
  }
  if (!/\d/.test(value)) return { error: 'Укажите номер дома, например: д. 1' }
  return { value }
}

/** Сегодняшняя дата в формате YYYY-MM-DD (по локальному времени сервера). */
export function todayString() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Проверяет российский номер телефона и приводит его к виду +7 (900) 123-45-67.
 * Принимает +7…, 8… или 10 цифр без кода страны, с любыми пробелами, скобками и дефисами.
 * Код города/оператора начинается с 3, 4, 8 или 9 (так устроена нумерация РФ).
 */
export function normalizePhone(raw) {
  const value = String(raw).trim()
  if (!PHONE_CHARS_RE.test(value)) return { error: 'Телефон может содержать только цифры, пробелы, +, скобки и дефис' }
  if (value.indexOf('+') > 0 || (value.startsWith('+') && !value.startsWith('+7'))) {
    return { error: 'Укажите российский номер: +7 или 8 в начале' }
  }
  let digits = value.replace(/\D/g, '')
  if (digits.length === 11 && /^[78]/.test(digits)) digits = digits.slice(1)
  else if (value.startsWith('+7')) digits = digits.slice(1)
  if (digits.length !== 10) return { error: 'Номер должен содержать 10 цифр после +7, пример: +7 (900) 123-45-67' }
  if (!/^[3489]/.test(digits)) return { error: 'Код города или оператора должен начинаться с 3, 4, 8 или 9' }
  return { value: `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}` }
}

/** Проверяет, что строка YYYY-MM-DD - существующая календарная дата (не 2026-02-31). */
function isRealDate(str) {
  if (!DATE_RE.test(str)) return false
  const [y, m, d] = str.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

/**
 * Проверяет одно значение по правилу. Возвращает { value } или { error }.
 * На вход приходит уже не пустое значение (пустые обрабатываются в validate).
 */
function checkValue(raw, rule) {
  switch (rule.type) {
    case 'string':
    case 'text': {
      if (typeof raw !== 'string' && typeof raw !== 'number') return { error: 'Должно быть строкой' }
      const value = String(raw).trim()
      const min = rule.min ?? 1
      if (value.length < min) return { error: `Минимум символов: ${min}` }
      if (rule.max && value.length > rule.max) return { error: `Максимум символов: ${rule.max}` }
      if (rule.pattern && !rule.pattern.test(value)) return { error: rule.patternMessage || 'Неверный формат' }
      return { value }
    }
    case 'name': {
      if (typeof raw !== 'string') return { error: 'Должно быть строкой' }
      const value = raw.trim().replace(/\s+/g, ' ')
      if (value.length < 2) return { error: 'Минимум 2 символа' }
      if (value.length > (rule.max || 100)) return { error: `Максимум символов: ${rule.max || 100}` }
      if (!NAME_RE.test(value)) return { error: 'Допустимы только буквы, пробелы, дефис и апостроф' }
      return { value }
    }
    case 'email': {
      if (typeof raw !== 'string') return { error: 'Должно быть строкой' }
      const value = raw.trim().toLowerCase()
      if (value.length > 254 || !EMAIL_RE.test(value)) return { error: 'Некорректный email' }
      return { value }
    }
    case 'phone': {
      if (typeof raw !== 'string') return { error: 'Должно быть строкой' }
      return normalizePhone(raw)
    }
    case 'address': {
      if (typeof raw !== 'string') return { error: 'Должно быть строкой' }
      return normalizeAddress(raw)
    }
    case 'password': {
      if (typeof raw !== 'string') return { error: 'Должно быть строкой' }
      // пароль не обрезаем: пробелы по краям - часть пароля
      if (raw.length < 8) return { error: 'Пароль должен быть не короче 8 символов' }
      if (raw.length > 72) return { error: 'Пароль должен быть не длиннее 72 символов' }
      if (!/[A-Za-zА-Яа-яЁё]/.test(raw) || !/\d/.test(raw)) {
        return { error: 'Пароль должен содержать хотя бы одну букву и одну цифру' }
      }
      return { value: raw }
    }
    case 'int':
    case 'number': {
      if (typeof raw === 'boolean' || (typeof raw === 'string' && raw.trim() === '')) {
        return { error: 'Должно быть числом' }
      }
      const value = Number(raw)
      if (!Number.isFinite(value)) return { error: 'Должно быть числом' }
      if (rule.type === 'int' && !Number.isInteger(value)) return { error: 'Должно быть целым числом' }
      if (rule.min !== undefined && value < rule.min) return { error: `Значение не меньше ${rule.min}` }
      if (rule.max !== undefined && value > rule.max) return { error: `Значение не больше ${rule.max}` }
      return { value: rule.type === 'number' ? Math.round(value * 100) / 100 : value }
    }
    case 'bool': {
      if (raw === true || raw === 'true' || raw === 1 || raw === '1') return { value: true }
      if (raw === false || raw === 'false' || raw === 0 || raw === '0') return { value: false }
      return { error: 'Должно быть true или false' }
    }
    case 'date': {
      if (typeof raw !== 'string' || !isRealDate(raw.trim())) return { error: 'Некорректная дата (формат ГГГГ-ММ-ДД)' }
      const value = raw.trim()
      const today = todayString()
      if (rule.notPast && value < today) return { error: 'Дата не может быть раньше сегодняшней' }
      if (rule.maxDaysAhead && value > addDays(today, rule.maxDaysAhead)) {
        return { error: `Дата не может быть позже чем через ${rule.maxDaysAhead} дн.` }
      }
      return { value }
    }
    case 'url': {
      if (typeof raw !== 'string') return { error: 'Должно быть строкой' }
      const value = raw.trim()
      if (value.length > 500 || !URL_RE.test(value)) return { error: 'Ссылка должна начинаться с http://, https:// или /' }
      return { value }
    }
    case 'intArray': {
      if (!Array.isArray(raw)) return { error: 'Должно быть списком' }
      const value = [...new Set(raw.map(Number))]
      if (value.some((n) => !Number.isInteger(n) || n < 1)) return { error: 'Некорректный список' }
      return { value }
    }
    default:
      throw new Error(`Неизвестный тип правила: ${rule.type}`)
  }
}

const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')

/**
 * Проверяет объект source по схеме.
 * Необязательные пустые поля возвращаются как null (или rule.default).
 * @returns {object} очищенные значения
 * @throws {HttpError} 400 с полем fields, если есть ошибки
 */
export function validate(source, schema) {
  const data = source && typeof source === 'object' ? source : {}
  const values = {}
  const errors = {}

  for (const [field, rule] of Object.entries(schema)) {
    const raw = data[field]
    if (isEmpty(raw)) {
      if (rule.required) errors[field] = rule.requiredMessage || 'Обязательное поле'
      else values[field] = rule.default ?? null
      continue
    }
    const { value, error } = checkValue(raw, rule)
    if (error) errors[field] = error
    else values[field] = value
  }

  if (Object.keys(errors).length > 0) {
    throw badRequest('Проверьте правильность заполнения полей', errors)
  }
  return values
}

/** Разбирает id из параметра маршрута; на мусор вроде /services/abc отвечает 400, а не 500. */
export function parseId(raw, label = 'id') {
  const id = Number(raw)
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw badRequest(`Некорректный ${label}`)
  return id
}
