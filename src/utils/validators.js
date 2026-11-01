/*
 * Правила валидации форм. Повторяют серверные (server/src/utils/validation.js),
 * чтобы пользователь видел ошибки сразу, без запроса к API.
 * Каждое правило возвращает текст ошибки или null.
 */
import { todayString } from './format.js'

const isBlank = (v) => v === undefined || v === null || String(v).trim() === ''

export const required = (message = 'Обязательное поле') =>
    (v) => (isBlank(v) ? message : null)

export const minLength = (n) => (v) =>
    (!isBlank(v) && String(v).trim().length < n ? `Минимум символов: ${n}` : null)

export const maxLength = (n) =>
    (v) => (!isBlank(v) && String(v).trim().length > n ? `Максимум символов: ${n}` : null)

export const email = () => (v) =>
  !isBlank(v) && (String(v).trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()))
    ? 'Некорректный email, пример: name@mail.ru'
    : null

export const personName = () => (v) => {
  if (isBlank(v)) return null
  const value = String(v).trim()
  if (value.length < 2) return 'Минимум 2 символа'
  if (value.length > 100) return 'Максимум 100 символов'
  return /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё\s'.-]*$/.test(value) ? null : 'Допустимы только буквы, пробелы, дефис и апостроф'
}

/**
 * Российский номер: +7 / 8 / без кода страны + 10 цифр, код начинается с 3, 4, 8 или 9.
 * Те же правила, что у normalizePhone() на сервере.
 */
export const phone = () => (v) => {
  if (isBlank(v)) return null
  const value = String(v).trim()
  if (!/^[\d\s()+-]+$/.test(value)) return 'Телефон может содержать только цифры, пробелы, +, скобки и дефис'
  if (value.indexOf('+') > 0 || (value.startsWith('+') && !value.startsWith('+7'))) {
    return 'Укажите российский номер: +7 или 8 в начале'
  }
  let digits = value.replace(/\D/g, '')
  if (digits.length === 11 && /^[78]/.test(digits)) digits = digits.slice(1)
  else if (value.startsWith('+7')) digits = digits.slice(1)
  if (digits.length !== 10) return 'Введите номер полностью: +7 (900) 123-45-67'
  if (!/^[3489]/.test(digits)) return 'Код города или оператора должен начинаться с 3, 4, 8 или 9'
  return null
}

/**
 * Адрес: проверка формата, те же правила, что у normalizeAddress() на сервере.
 * Нужны слово из 3+ букв (город/улица) и цифра (номер дома); длина 5-255.
 */
export const address = () => (v) => {
  if (isBlank(v)) return null
  const value = String(v).trim().replace(/\s+/g, ' ')
  if (value.length < 5) return 'Адрес слишком короткий'
  if (value.length > 255) return 'Максимум символов: 255'
  if (!/^[A-Za-zА-Яа-яЁё0-9\s.,\-/№()«»"']+$/.test(value)) {
    return 'Адрес может содержать только буквы, цифры, пробелы и знаки . , - / № ( ) « » " \''
  }
  if (/(.)\1{4,}/.test(value)) return 'Адрес похож на случайный набор символов'
  if (!/[A-Za-zА-Яа-яЁё]{3,}/.test(value)) return 'Укажите город и улицу словами, например: г. Москва, ул. Тверская, д. 1'
  if (!/\d/.test(value)) return 'Укажите номер дома, например: д. 1'
  return null
}

export const password = () => (v) => {
  if (isBlank(v)) return null
  if (v.length < 8) return 'Пароль должен быть не короче 8 символов'
  if (v.length > 72) return 'Пароль должен быть не длиннее 72 символов'
  if (!/[A-Za-zА-Яа-яЁё]/.test(v) || !/\d/.test(v)) return 'Пароль должен содержать хотя бы одну букву и одну цифру'
  return null
}

/** Значение должно совпадать с другим полем формы (подтверждение пароля). */
export const sameAs = (field, message) => (v, values) => (!isBlank(v) && v !== values[field] ? message : null)

export const number = ({ min, max, integer = false } = {}) => (v) => {
  if (isBlank(v)) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return 'Введите число'
  if (integer && !Number.isInteger(n)) return 'Введите целое число'
  if (min !== undefined && n < min) return `Не меньше ${min}`
  if (max !== undefined && n > max) return `Не больше ${max}`
  return null
}

/** Дата 'YYYY-MM-DD' не раньше сегодня и не позже чем через maxDaysAhead дней. */
export const futureDate = (maxDaysAhead) => (v) => {
  if (isBlank(v)) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Некорректная дата'
  if (v < todayString()) return 'Дата не может быть раньше сегодняшней'
  if (maxDaysAhead && v > todayString(maxDaysAhead)) return `Можно выбрать дату не позже чем через ${maxDaysAhead} дней`
  return null
}

export const url = () => (v) =>
  !isBlank(v) && (String(v).trim().length > 500 || !/^(https?:\/\/\S+|\/\S*)$/.test(String(v).trim()))
    ? 'Ссылка должна начинаться с http://, https:// или /'
    : null

/**
 * Проверяет значения формы по схеме { поле: [правило, ...] }.
 * Возвращает объект ошибок { поле: 'текст' } - пустой, если все верно.
 */
export function validateForm(values, schema) {
  const errors = {}
  for (const [field, rules] of Object.entries(schema)) {
    for (const rule of rules) {
      const error = rule(values[field], values)
      if (error) {
        errors[field] = error
        break
      }
    }
  }
  return errors
}
